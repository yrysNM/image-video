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

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface ZenQuote {
  q?: unknown;
  a?: unknown;
}

async function fetchZenQuotes(): Promise<Quote[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch("https://zenquotes.io/api/quotes", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ZenQuotes responded ${res.status}`);
    }
    const data = (await res.json()) as ZenQuote[];
    if (!Array.isArray(data)) {
      throw new Error("Unexpected ZenQuotes payload");
    }
    const quotes = data
      .map((item) => ({
        text: typeof item.q === "string" ? item.q.trim() : "",
        author: typeof item.a === "string" && item.a.trim() ? item.a.trim() : "Unknown",
      }))
      .filter(
        (quote) =>
          quote.text.length > 0 &&
          !/too many requests/i.test(quote.text) &&
          !/zenquotes\.io/i.test(quote.author)
      );
    if (quotes.length === 0) {
      throw new Error("ZenQuotes returned no usable quotes");
    }
    return quotes;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns `count` quotes, preferring the free ZenQuotes API and falling back to
 * the bundled curated list if it is unavailable or rate-limited.
 */
export async function getQuotes(count: number): Promise<Quote[]> {
  let pool: Quote[];
  try {
    pool = await fetchZenQuotes();
  } catch {
    pool = CURATED_QUOTES;
  }

  const shuffled = shuffle(pool);
  const result: Quote[] = [];
  const fallback = shuffle(CURATED_QUOTES);
  for (let i = 0; i < count; i += 1) {
    result.push(shuffled[i] ?? fallback[i % fallback.length]);
  }
  return result;
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
}

export async function buildWallpapers({
  count,
  theme,
  source,
  salt,
  offset = 0,
}: BuildWallpapersOptions): Promise<Wallpaper[]> {
  const quotes = await getQuotes(count);
  const cleanTheme = theme.trim();
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
