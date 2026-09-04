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

// Deterministic non-negative integer from a seed string, used as LoremFlickr's
// `lock` so each card is stable and distinct across a generation.
function seedLock(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 100000;
}

function remoteImageUrl(source: WallpaperSource, theme: string, seed: string): string {
  if (source === "photo") {
    // LoremFlickr serves real, theme-matched Creative Commons photos (keyless).
    const words = theme.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const tags = (words.length ? words : ["nature", "landscape"])
      .map(encodeURIComponent)
      .join(",");
    return `https://${LOREMFLICKR_HOST}/768/1024/${tags}?lock=${seedLock(seed)}`;
  }
  const subject = theme.trim() || "serene inspirational landscape";
  const prompt = `${subject}, cinematic, soft natural light, atmospheric, high detail, wallpaper, no text`;
  const params = new URLSearchParams({
    width: "768",
    height: "1024",
    nologo: "true",
    seed,
  });
  return `https://${POLLINATIONS_HOST}/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
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
  return quotes.map((quote, index) => {
    const itemIndex = offset + index;
    const seed = `${cleanTheme || "muse"}-${salt}-${itemIndex}`;
    const remoteUrl = remoteImageUrl(source, cleanTheme, seed);
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
