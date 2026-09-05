import { CATEGORY_QUOTES, type QuoteCategory } from "./quotes-data";

export type WallpaperSource = "ai" | "photo";

export interface Quote {
  text: string;
  author: string;
}

export interface Wallpaper {
  id: string;
  imageUrl: string;
  remoteUrl: string;
  source: WallpaperSource;
  theme: string;
  quote: string;
  author: string;
}

// Bundled fallback so the page always works offline / when the free quote
// service rate-limits us. Meaningful, public-domain-style motivational lines.
const CURATED_QUOTES: Quote[] = [
  { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "What we think, we become.", author: "Buddha" },
  { text: "Do not go where the path may lead, go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Happiness is not something ready made. It comes from your own actions.", author: "Dalai Lama" },
  { text: "The best time to plant a tree was twenty years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Whatever you are, be a good one.", author: "Abraham Lincoln" },
  { text: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Keep your face always toward the sunshine and shadows will fall behind you.", author: "Walt Whitman" },
  { text: "Everything you can imagine is real.", author: "Pablo Picasso" },
  { text: "Wherever you go, go with all your heart.", author: "Confucius" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "The mind is everything. What you think you become.", author: "Buddha" },
  { text: "Little by little, one travels far.", author: "J.R.R. Tolkien" },
  { text: "Stars can't shine without darkness.", author: "D.H. Sidebottom" },
  { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { text: "The quieter you become, the more you are able to hear.", author: "Rumi" },
  { text: "A calm sea never made a skilled sailor.", author: "Franklin D. Roosevelt" },
  { text: "Be like the flower that gives its fragrance even to the hand that crushes it.", author: "Ali ibn Abi Talib" },
];

// --- Deterministic, non-repeating quote selection -------------------------
// Quotes come from a fixed, de-duplicated pool that is shuffled with a
// per-generation seed (`salt`) and indexed by absolute position, so a gallery
// never shows the same quote twice (until its pool is exhausted, which then
// stops pagination).

function dedupeByText(quotes: Quote[]): Quote[] {
  const seen = new Set<string>();
  const out: Quote[] = [];
  for (const quote of quotes) {
    const key = quote.text.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(quote);
    }
  }
  return out;
}

// "Any" draws from every curated quote across all categories (a large, stable,
// unique pool — no network dependency, so results are reliable and repeat-free).
const ANY_POOL: Quote[] = dedupeByText([
  ...CURATED_QUOTES,
  ...Object.values(CATEGORY_QUOTES).flat(),
]);

function poolForCategory(category: QuoteCategory): Quote[] {
  if (category === "any") {
    return ANY_POOL;
  }
  return dedupeByText(CATEGORY_QUOTES[category] ?? ANY_POOL);
}

function hashString(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher–Yates shuffle seeded by a string. */
function seededShuffle<T>(input: T[], seed: string): T[] {
  const arr = [...input];
  const rand = mulberry32(hashString(seed));
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Quotes for absolute positions [offset, offset + count) from a per-generation
 * shuffled pool. No cycling: once the pool is exhausted the result is shorter
 * (or empty), so every quote shown in a gallery is unique.
 */
export function quotesForRange(
  category: QuoteCategory,
  salt: string,
  offset: number,
  count: number
): Quote[] {
  const ordered = seededShuffle(poolForCategory(category), salt);
  return ordered.slice(offset, offset + count);
}

const LOREMFLICKR_HOST = "loremflickr.com";
const POLLINATIONS_HOST = "image.pollinations.ai";

function photoTags(theme: string): string {
  const words = theme.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (words.length ? words : ["nature", "landscape"])
    .map(encodeURIComponent)
    .join(",");
}

function loremflickrUrl(tags: string, lock: number): string {
  return `https://${LOREMFLICKR_HOST}/768/1024/${tags}?lock=${lock}`;
}

// Pollinations requires an INTEGER `seed`; a non-numeric seed is silently
// ignored, so every card sharing a prompt returns the *same* image. Deriving a
// stable number from the per-card seed string gives each card a unique image.
function aiImageUrl(theme: string, seed: string): string {
  const subject = theme.trim() || "serene inspirational landscape";
  const prompt = `${subject}, cinematic, soft natural light, atmospheric, high detail, wallpaper, no text`;
  const params = new URLSearchParams({
    width: "768",
    height: "1024",
    nologo: "true",
    seed: String(hashString(seed)),
  });
  return `https://${POLLINATIONS_HOST}/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

// --- Unique photo selection ------------------------------------------------
// LoremFlickr maps some `lock` values to a shared "defaultImage" placeholder
// and can repeat photos, so we resolve each lock's redirect target server-side,
// drop the placeholder, and de-duplicate by resolved image. Results are cached
// per generation (theme + salt) as an ordered, growing list, so infinite-scroll
// pages never repeat a photo either.
interface PhotoList {
  urls: string[];
  used: Set<string>;
  nextLock: number;
  probes: number;
}

const photoCache = new Map<string, PhotoList>();

async function resolvePhotoTarget(
  tags: string,
  lock: number
): Promise<string | null> {
  const url = loremflickrUrl(tags, lock);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    const location = res.headers.get("location");
    if (!location) {
      return res.ok ? url : null;
    }
    const resolved = new URL(location, `https://${LOREMFLICKR_HOST}`).toString();
    if (resolved.includes("defaultImage")) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fillPhotoList(
  entry: PhotoList,
  tags: string,
  target: number
): Promise<void> {
  const maxProbes = target * 6 + 60;
  while (entry.urls.length < target && entry.probes < maxProbes) {
    const need = target - entry.urls.length;
    const batch = Math.min(Math.max(need * 2, 4), 16);
    const locks: number[] = [];
    for (let i = 0; i < batch; i += 1) {
      locks.push(entry.nextLock);
      entry.nextLock = (entry.nextLock + 1) % 100000;
      entry.probes += 1;
    }
    const results = await Promise.all(
      locks.map((lock) => resolvePhotoTarget(tags, lock))
    );
    for (const resolved of results) {
      if (entry.urls.length >= target) {
        break;
      }
      if (resolved && !entry.used.has(resolved)) {
        entry.used.add(resolved);
        entry.urls.push(resolved);
      }
    }
  }
}

/**
 * Resolved, de-duplicated photo URLs for absolute positions
 * [offset, offset + count). Stable per (theme, salt): infinite-scroll pages
 * extend the same ordered list, so a gallery never shows the same photo twice.
 */
async function photoUrlsForRange(
  theme: string,
  salt: string,
  offset: number,
  count: number
): Promise<string[]> {
  const tags = photoTags(theme);
  const key = `${tags}|${salt}`;
  let entry = photoCache.get(key);
  if (!entry) {
    entry = {
      urls: [],
      used: new Set(),
      nextLock: hashString(key) % 100000,
      probes: 0,
    };
    photoCache.set(key, entry);
  }
  await fillPhotoList(entry, tags, offset + count);
  return entry.urls.slice(offset, offset + count);
}

/** Same-origin proxy path so the browser can composite images onto a canvas. */
export function proxiedImageUrl(remoteUrl: string): string {
  return `/api/wallpaper-image?src=${encodeURIComponent(remoteUrl)}`;
}

const ALLOWED_IMAGE_HOSTS = new Set([
  LOREMFLICKR_HOST,
  POLLINATIONS_HOST,
]);

/** Validates a proxy `src` param against the image host allowlist (SSRF guard). */
export function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export interface BuildWallpapersOptions {
  count: number;
  theme: string;
  source: WallpaperSource;
  salt: string;
  offset?: number;
  category?: QuoteCategory;
}

export async function buildWallpapers({
  count,
  theme,
  source,
  salt,
  offset = 0,
  category = "any",
}: BuildWallpapersOptions): Promise<Wallpaper[]> {
  const cleanTheme = theme.trim();
  const quotes = quotesForRange(category, salt, offset, count);

  // Photos are resolved + de-duplicated server-side; AI images use a numeric
  // seed. Either way, every card in a generation gets a distinct image.
  const photoUrls =
    source === "photo" && quotes.length > 0
      ? await photoUrlsForRange(cleanTheme, salt, offset, quotes.length)
      : [];

  return quotes.map((quote, index) => {
    const itemIndex = offset + index;
    const seed = `${cleanTheme || "muse"}-${salt}-${itemIndex}`;
    const remoteUrl =
      source === "photo"
        ? photoUrls[index] ??
          loremflickrUrl(photoTags(cleanTheme), hashString(seed) % 100000)
        : aiImageUrl(cleanTheme, seed);
    return {
      id: `${salt}-${itemIndex}`,
      imageUrl: proxiedImageUrl(remoteUrl),
      remoteUrl,
      source,
      theme: cleanTheme,
      quote: quote.text,
      author: quote.author,
    };
  });
}
