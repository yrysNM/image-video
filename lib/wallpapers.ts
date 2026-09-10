import type { QuoteCategory } from "./quotes-data";
import { fetchLiveQuotes, quoteMatchesCategory } from "./quotes-api";

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

// --- Deterministic, non-repeating quote selection -------------------------
// Quotes come from live public APIs, shuffled with a per-generation seed
// (`salt`) and indexed by absolute position, so a gallery never shows the
// same quote twice. Infinite scroll stops when the pool is exhausted.

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

const CATEGORY_POOL_TTL_MS = 10 * 60 * 1000;
const categoryPoolCache = new Map<
  QuoteCategory,
  { quotes: Quote[]; expires: number }
>();
const categoryPoolInflight = new Map<QuoteCategory, Promise<Quote[]>>();

async function loadPoolForCategory(category: QuoteCategory): Promise<Quote[]> {
  const live = (await fetchLiveQuotes()).filter((quote) =>
    quoteMatchesCategory(quote, category)
  );
  const quotes = dedupeByText(live);
  categoryPoolCache.set(category, {
    quotes,
    expires: Date.now() + CATEGORY_POOL_TTL_MS,
  });
  return quotes;
}

async function poolForCategory(category: QuoteCategory): Promise<Quote[]> {
  const hit = categoryPoolCache.get(category);
  if (hit && hit.expires > Date.now()) {
    return hit.quotes;
  }
  const pending = categoryPoolInflight.get(category);
  if (pending) {
    return pending;
  }
  const work = loadPoolForCategory(category).finally(() => {
    categoryPoolInflight.delete(category);
  });
  categoryPoolInflight.set(category, work);
  return work;
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

export async function quotePoolSize(category: QuoteCategory): Promise<number> {
  return (await poolForCategory(category)).length;
}

/**
 * Quotes for absolute positions [offset, offset + count) from a per-generation
 * shuffled pool. No cycling: once the pool is exhausted the result is shorter
 * (or empty), so every quote shown in a gallery is unique.
 */
export async function quotesForRange(
  category: QuoteCategory,
  salt: string,
  offset: number,
  count: number
): Promise<Quote[]> {
  const ordered = seededShuffle(await poolForCategory(category), salt);
  if (ordered.length === 0 || count <= 0 || offset >= ordered.length) {
    return [];
  }
  const start = Math.max(0, offset);
  return ordered.slice(start, start + count);
}

const LOREMFLICKR_HOST = "loremflickr.com";
const POLLINATIONS_HOST = "image.pollinations.ai";

// --- Quote → image subject -------------------------------------------------
// Each image is chosen to reflect the *meaning of its quote*. We scan the quote
// for evocative words and map them to photo-friendly subjects (comma-separated
// tags that LoremFlickr has plenty of matches for, and which double as an AI
// prompt subject). Concrete imagery ("sea", "tree", "stars") wins over abstract
// themes ("time", "wisdom"); if nothing matches we fall back to the selected
// category's mood, then to a generic natural scene.

// Concrete, literal imagery mentioned in the quote — the strongest match.
const CONCRETE_SUBJECTS: Record<string, string> = {
  sea: "ocean,sea", ocean: "ocean,sea", sail: "sailboat,ocean", sailor: "sailboat,ocean",
  boat: "boat,ocean", boats: "boat,ocean", wave: "ocean,waves", waves: "ocean,waves",
  tide: "ocean,coast", shore: "coast,ocean", current: "ocean,waves",
  tree: "forest,tree", trees: "forest,trees", plant: "forest,plant", forest: "forest,trees",
  leaf: "forest,leaves", leaves: "forest,leaves", roots: "forest,roots", wood: "forest,woods",
  flower: "flowers,garden", flowers: "flowers,garden", bloom: "flowers,blossom",
  blossom: "blossom,flowers", garden: "garden,flowers", fragrance: "flowers,garden",
  rose: "rose,flowers", petal: "flowers,blossom",
  star: "stars,night,sky", stars: "stars,night,sky", cosmos: "stars,galaxy",
  universe: "stars,galaxy", galaxy: "stars,galaxy", moon: "moon,night,sky",
  night: "night,sky,stars", dark: "night,sky", darkness: "night,sky", shadow: "shadow,light",
  shadows: "shadow,light",
  sun: "sunrise,sun", sunshine: "sunshine,meadow", sunrise: "sunrise,sky",
  sunset: "sunset,sky", dawn: "dawn,sunrise", dusk: "dusk,sunset", daylight: "sunlight,sky",
  mountain: "mountains", mountains: "mountains", peak: "mountains,peak", peaks: "mountains,peak",
  summit: "mountains,summit", climb: "mountains,climbing", hill: "hills,landscape",
  cliff: "cliff,coast",
  sky: "sky,clouds", cloud: "clouds,sky", clouds: "clouds,sky", horizon: "horizon,sky",
  rain: "rain,storm", storm: "storm,clouds", thunder: "storm,lightning",
  snow: "snow,mountains", ice: "ice,winter", winter: "winter,snow", frost: "frost,winter",
  river: "river,water", stream: "stream,water", lake: "lake,water", waterfall: "waterfall,water",
  water: "water,river",
  road: "road,path", path: "path,forest", trail: "trail,mountains", journey: "path,journey",
  wander: "path,forest", steps: "stairs,path", step: "stairs,path", footsteps: "path,sand",
  bird: "bird,sky", birds: "birds,sky", wings: "bird,wings", fly: "bird,sky",
  flight: "bird,sky", caged: "bird,cage",
  fire: "fire,flames", flame: "fire,flames", spark: "sparks,fire", light: "light,glow",
  candle: "candle,light",
  book: "books,library", books: "books,library", read: "books,reading", story: "books,library",
  pages: "book,pages", novel: "books,library", library: "library,books", words: "book,writing",
  written: "book,writing", write: "writing,book",
  heart: "heart,love", desert: "desert,dunes", dune: "desert,dunes", sand: "desert,sand",
  labyrinth: "maze,labyrinth", maze: "maze,labyrinth", bridge: "bridge,architecture",
  door: "door,architecture", key: "key,door",
};

// Abstract themes → a fitting visual metaphor.
const ABSTRACT_SUBJECTS: Record<string, string> = {
  life: "sunrise,landscape", live: "sunrise,landscape", living: "sunrise,landscape",
  alive: "sunrise,landscape",
  time: "clock,hourglass", hour: "clock,hourglass", hours: "clock,hourglass",
  minute: "clock,hourglass", today: "sunrise,horizon", tomorrow: "sunrise,horizon",
  yesterday: "sunset,horizon", clock: "clock,hourglass",
  love: "sunset,ocean", loved: "sunset,ocean", loving: "sunset,ocean",
  success: "mountains,summit", achieve: "mountains,summit", opportunity: "mountains,summit",
  opportunities: "mountains,summit", victory: "mountains,summit",
  wisdom: "library,books", wise: "library,books", knowledge: "library,books",
  learn: "library,books", reflection: "calm,lake", mind: "calm,lake",
  courage: "mountains", brave: "mountains", strength: "mountains", strong: "mountains",
  fear: "mountains,fog", fearless: "mountains",
  happy: "meadow,sunshine", happiness: "meadow,sunshine", happiest: "meadow,sunshine",
  joy: "meadow,sunshine", smile: "meadow,sunshine", smiles: "meadow,sunshine",
  enjoy: "meadow,sunshine",
  dream: "clouds,sky", dreams: "clouds,sky", imagine: "clouds,sky", imagination: "clouds,sky",
  peace: "lake,calm", calm: "lake,calm", patience: "lake,calm", patient: "lake,calm",
  quiet: "lake,calm", quieter: "lake,calm", listen: "lake,calm", silence: "lake,calm",
  hope: "sunrise,horizon", future: "sunrise,horizon", believe: "sunrise,horizon",
  faith: "sunrise,horizon",
  adventure: "mountains,trail", explore: "mountains,trail", discover: "mountains,trail",
  past: "forest,fog", memory: "forest,fog", memories: "forest,fog",
  suffering: "mountains,fog", wounds: "mountains,fog", broken: "mountains,fog",
  agony: "mountains,fog", pain: "mountains,fog",
};

const CATEGORY_SUBJECTS: Record<Exclude<QuoteCategory, "any">, string> = {
  life: "sunrise,landscape",
  time: "clock,hourglass",
  love: "sunset,ocean",
  success: "mountains,summit",
  wisdom: "library,books",
  motivation: "mountains,trail",
  happiness: "meadow,sunshine",
  books: "library,books",
};

const DEFAULT_SUBJECT = "nature,landscape";

function quoteWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Picks image tags that reflect a quote's meaning (concrete > abstract > category). */
function subjectForQuote(quote: Quote, category: QuoteCategory): string {
  const words = quoteWords(quote.text);
  for (const word of words) {
    if (CONCRETE_SUBJECTS[word]) {
      return CONCRETE_SUBJECTS[word];
    }
  }
  for (const word of words) {
    if (ABSTRACT_SUBJECTS[word]) {
      return ABSTRACT_SUBJECTS[word];
    }
  }
  if (category !== "any" && CATEGORY_SUBJECTS[category]) {
    return CATEGORY_SUBJECTS[category];
  }
  return DEFAULT_SUBJECT;
}

/** LoremFlickr tag string = quote subject, optionally biased by a user theme. */
function photoTags(subject: string, theme: string): string {
  const parts = [
    ...subject.split(","),
    ...theme.trim().toLowerCase().split(/\s+/),
  ]
    .map((part) => part.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(parts)).map(encodeURIComponent);
  return (unique.length ? unique : ["nature", "landscape"]).join(",");
}

function loremflickrUrl(tags: string, lock: number): string {
  return `https://${LOREMFLICKR_HOST}/768/1024/${tags}?lock=${lock}`;
}

// Pollinations requires an INTEGER `seed`; a non-numeric seed is silently
// ignored, so every card sharing a prompt returns the *same* image. Deriving a
// stable number from the per-card seed string gives each card a unique image.
function aiImageUrl(subject: string, theme: string, seed: string): string {
  const scene = [subject.split(",").join(" "), theme.trim()]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  const prompt = `${scene || "serene inspirational landscape"}, cinematic, soft natural light, atmospheric, high detail, wallpaper, no text`;
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
// and can repeat photos, so we resolve each lock's redirect server-side and drop
// the placeholder. Because several quotes can map to the same subject, we also
// de-duplicate by resolved image across the whole generation (per salt), so a
// gallery never shows the same photo twice — even across infinite-scroll pages.
const photoUsedCache = new Map<string, Set<string>>();
const PHOTO_USED_CACHE_LIMIT = 48;

function usedSetFor(salt: string): Set<string> {
  let used = photoUsedCache.get(salt);
  if (!used) {
    used = new Set();
    photoUsedCache.set(salt, used);
    while (photoUsedCache.size > PHOTO_USED_CACHE_LIMIT) {
      const oldest = photoUsedCache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      photoUsedCache.delete(oldest);
    }
  }
  return used;
}

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

const PHOTO_CANDIDATES = 8;

/**
 * One quote-relevant, unique photo URL per quote. Each quote's subject drives
 * its tags; candidate locks are resolved in parallel and the first resolved
 * image not already used in this generation is chosen.
 */
async function photosForQuotes(
  quotes: Quote[],
  theme: string,
  category: QuoteCategory,
  salt: string,
  offset: number
): Promise<string[]> {
  const used = usedSetFor(salt);
  const specs = quotes.map((quote, index) => {
    const subject = subjectForQuote(quote, category);
    const tags = photoTags(subject, theme);
    const base = hashString(`${salt}|${tags}|${offset + index}`) % 100000;
    const locks = Array.from(
      { length: PHOTO_CANDIDATES },
      (_, step) => (base + step) % 100000
    );
    return { tags, locks };
  });

  const resolvedPerCard = await Promise.all(
    specs.map((spec) =>
      Promise.all(spec.locks.map((lock) => resolvePhotoTarget(spec.tags, lock)))
    )
  );

  return specs.map((spec, index) => {
    for (const resolved of resolvedPerCard[index]) {
      if (resolved && !used.has(resolved)) {
        used.add(resolved);
        return resolved;
      }
    }
    // Fall back to a direct lock URL (network hiccup / very sparse subject).
    const fallback = loremflickrUrl(spec.tags, spec.locks[0]);
    used.add(fallback);
    return fallback;
  });
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
  const quotes = await quotesForRange(category, salt, offset, count);

  // Every image reflects the meaning of its own quote. Photos are resolved +
  // de-duplicated server-side; AI images use a quote-derived prompt with a
  // numeric seed. Either way, each card gets a distinct, on-topic image.
  const photoUrls =
    source === "photo" && quotes.length > 0
      ? await photosForQuotes(quotes, cleanTheme, category, salt, offset)
      : [];

  return quotes.map((quote, index) => {
    const itemIndex = offset + index;
    const subject = subjectForQuote(quote, category);
    const seed = `${subject}-${cleanTheme || "muse"}-${salt}-${itemIndex}`;
    const remoteUrl =
      source === "photo"
        ? photoUrls[index] ??
          loremflickrUrl(photoTags(subject, cleanTheme), hashString(seed) % 100000)
        : aiImageUrl(subject, cleanTheme, seed);
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
