import type { QuoteCategory } from "./quotes-data";

export interface RemoteQuote {
  text: string;
  author: string;
}

const DUMMYJSON_QUOTES_URL = "https://dummyjson.com/quotes";
const ZENQUOTES_URL = "https://zenquotes.io/api/quotes";
const QUOTES_ON_DESIGN_URL =
  "https://quotesondesign.com/wp-json/wp/v2/posts?per_page=20";

const LIVE_CACHE_TTL_MS = 30 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 30 * 1000;
const DUMMYJSON_BATCH_SIZE = 1500;
const MAX_QUOTE_LENGTH = 320;
const MIN_QUOTE_LENGTH = 16;

const CATEGORY_KEYWORDS: Record<Exclude<QuoteCategory, "any">, string[]> = {
  life: ["life", "live", "living", "lives"],
  time: ["time", "today", "tomorrow", "yesterday", "hour", "moment"],
  love: ["love", "loved", "loving", "heart"],
  success: ["success", "succeed", "successful", "victory"],
  wisdom: ["wisdom", "wise", "knowledge", "know"],
  motivation: ["courage", "goal", "persist", "begin", "effort", "dream"],
  happiness: ["happy", "happiness", "happiest", "joy", "joyful", "smile"],
  books: [
    "book",
    "books",
    "read",
    "reading",
    "reader",
    "novel",
    "library",
    "author",
    "page",
    "pages",
    "story",
    "stories",
    "written",
    "write",
    "writing",
    "writer",
    "words",
    "word",
    "learn",
    "learning",
    "literature",
    "poem",
    "poetry",
    "chapter",
    "publish",
    "published",
    "paper",
    "essay",
    "journal",
    "text",
  ],
};

interface CacheEntry {
  value: RemoteQuote[];
  expires: number;
  failed?: boolean;
}

const cache = new Map<string, CacheEntry>();

function quoteKey(text: string): string {
  return text.trim().toLowerCase();
}

function usableQuote(text: string, author: string): RemoteQuote | null {
  const cleanText = text.replace(/\s+/g, " ").trim();
  const cleanAuthor = author.replace(/\s+/g, " ").trim() || "Unknown";
  if (
    cleanText.length < MIN_QUOTE_LENGTH ||
    cleanText.length > MAX_QUOTE_LENGTH ||
    /too many requests/i.test(cleanText) ||
    /zenquotes\.io/i.test(cleanAuthor)
  ) {
    return null;
  }
  return { text: cleanText, author: cleanAuthor };
}

function decodeEntities(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&#8217;|&rsquo;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—")
    .replace(/&#8220;|&ldquo;/gi, "“")
    .replace(/&#8221;|&rdquo;/gi, "”")
    .replace(/&#\d+;/g, "")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url: string, timeoutMs = 7000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "ImageToVideo/1.0",
      },
    });
    if (!res.ok) {
      throw new Error(`${url} responded ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function cachedFetch(
  key: string,
  ttlMs: number,
  loader: () => Promise<RemoteQuote[]>
): Promise<RemoteQuote[]> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    if (hit.failed) {
      throw new Error(`${key} recently failed`);
    }
    return hit.value;
  }
  try {
    const value = await loader();
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  } catch (error) {
    cache.set(key, {
      value: [],
      expires: Date.now() + FAILURE_CACHE_TTL_MS,
      failed: true,
    });
    throw error;
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mergeUniqueQuotes(sources: RemoteQuote[][]): RemoteQuote[] {
  const seen = new Set<string>();
  const merged: RemoteQuote[] = [];
  for (const list of sources) {
    for (const quote of list) {
      const key = quoteKey(quote.text);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(quote);
    }
  }
  return merged;
}

/** Load DummyJSON's full quote catalog (~1454 items) in one request. */
async function fetchAllDummyJsonQuotes(): Promise<RemoteQuote[]> {
  const data = await fetchJson(
    `${DUMMYJSON_QUOTES_URL}?limit=${DUMMYJSON_BATCH_SIZE}&skip=0`,
    15000
  );
  if (!data || typeof data !== "object") {
    return [];
  }
  const list = (data as { quotes?: unknown }).quotes;
  if (!Array.isArray(list)) {
    return [];
  }
  const quotes: RemoteQuote[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as { quote?: unknown; author?: unknown };
    const quote = usableQuote(readString(row.quote), readString(row.author));
    if (quote) {
      quotes.push(quote);
    }
  }
  return quotes;
}

async function fetchZenQuotes(): Promise<RemoteQuote[]> {
  const data = await fetchJson(ZENQUOTES_URL);
  if (!Array.isArray(data)) {
    return [];
  }
  const quotes: RemoteQuote[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as { q?: unknown; a?: unknown };
    const quote = usableQuote(readString(row.q), readString(row.a));
    if (quote) {
      quotes.push(quote);
    }
  }
  return quotes;
}

async function fetchQuotesOnDesign(): Promise<RemoteQuote[]> {
  const data = await fetchJson(QUOTES_ON_DESIGN_URL);
  if (!Array.isArray(data)) {
    return [];
  }
  const quotes: RemoteQuote[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as {
      title?: { rendered?: unknown };
      content?: { rendered?: unknown };
    };
    const author = decodeEntities(readString(row.title?.rendered));
    const text = decodeEntities(readString(row.content?.rendered));
    const quote = usableQuote(text, author);
    if (quote) {
      quotes.push(quote);
    }
  }
  return quotes;
}

export function quoteMatchesCategory(
  quote: RemoteQuote,
  category: QuoteCategory
): boolean {
  if (category === "any") {
    return true;
  }
  const keywords = CATEGORY_KEYWORDS[category];
  const haystack = `${quote.text} ${quote.author}`.toLowerCase();
  return keywords.some((word) => new RegExp(`\\b${word}\\b`, "i").test(haystack));
}

/**
 * Full de-duplicated quote catalog from DummyJSON pagination plus
 * supplementary live sources. Throws when every source fails.
 */
export async function fetchLiveQuotes(): Promise<RemoteQuote[]> {
  const results = await Promise.allSettled([
    cachedFetch("dummyjson-all", LIVE_CACHE_TTL_MS, fetchAllDummyJsonQuotes),
    cachedFetch("zenquotes", LIVE_CACHE_TTL_MS, fetchZenQuotes),
    cachedFetch("quotesondesign", LIVE_CACHE_TTL_MS, fetchQuotesOnDesign),
  ]);

  const batches: RemoteQuote[][] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.length > 0) {
      batches.push(result.value);
    }
  }

  const merged = mergeUniqueQuotes(batches);
  if (merged.length === 0) {
    throw new Error("Quotes could not be fetched.");
  }
  return merged;
}
