"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Wallpaper, WallpaperSource } from "@/lib/wallpapers";
import { QUOTE_CATEGORIES, type QuoteCategory } from "@/lib/quotes-data";
import { NoInternetPage } from "./NoInternetPage";
import { WallpaperCard } from "./WallpaperCard";

const THEME_SUGGESTIONS = [
  "Misty mountains",
  "Ocean waves",
  "Starry night sky",
  "Autumn forest",
  "Desert dunes",
  "City at dusk",
  "Minimal gradient",
  "Cherry blossoms",
];

const PAGE_SIZE = 6;

// Remember the user's last-picked quote category across visits.
const CATEGORY_STORAGE_KEY = "imagetovideo:wallpaper-quote-category";

function isQuoteCategory(value: string | null): value is QuoteCategory {
  return !!value && QUOTE_CATEGORIES.some((c) => c.value === value);
}

function readStoredCategory(): QuoteCategory | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    return isQuoteCategory(stored) ? stored : null;
  } catch {
    return null;
  }
}

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function isNetworkError(err: unknown): boolean {
  if (isBrowserOffline()) {
    return true;
  }
  if (err instanceof TypeError) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network request failed|load failed/i.test(
    message
  );
}

function quoteKey(quote: string): string {
  return quote.trim().toLowerCase();
}

function uniqueWallpapers(current: Wallpaper[], incoming: Wallpaper[]): Wallpaper[] {
  const seenIds = new Set(current.map((item) => item.id));
  const seenQuotes = new Set(current.map((item) => quoteKey(item.quote)));
  const extra: Wallpaper[] = [];
  for (const item of incoming) {
    const key = quoteKey(item.quote);
    if (seenIds.has(item.id) || seenQuotes.has(key)) {
      continue;
    }
    seenIds.add(item.id);
    seenQuotes.add(key);
    extra.push(item);
  }
  return extra;
}

function WallpaperSkeleton() {
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-200">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-slate-200 via-slate-300/80 to-slate-400/60" />
      <div className="absolute left-3 top-3 h-5 w-16 animate-pulse rounded-full bg-white/50" />
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5">
        <div className="h-5 w-11/12 animate-pulse rounded-lg bg-white/65" />
        <div className="h-5 w-8/12 animate-pulse rounded-lg bg-white/50" />
        <div className="mt-3 h-3 w-1/3 animate-pulse rounded-lg bg-white/40" />
        <div className="mt-4 flex gap-2">
          <div className="h-7 w-20 animate-pulse rounded-lg bg-white/55" />
          <div className="h-7 w-24 animate-pulse rounded-lg bg-white/35" />
        </div>
      </div>
    </div>
  );
}

type WallpapersResponse = {
  items: Wallpaper[];
  salt: string;
  offset: number;
  hasMore?: boolean;
};

export function WallpaperGallery() {
  const [theme, setTheme] = useState("");
  const [source, setSource] = useState<WallpaperSource>("ai");
  const [category, setCategory] = useState<QuoteCategory>("any");
  const [items, setItems] = useState<Wallpaper[]>([]);
  const [salt, setSalt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const didInit = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const requestGenRef = useRef(0);
  const nextOffsetRef = useRef(0);
  const requestParamsRef = useRef({ theme, source, category });

  requestParamsRef.current = { theme, source, category };

  const fetchWallpapers = useCallback(
    async (options: { append?: boolean; offset?: number; salt?: string | null } = {}) => {
      const append = options.append ?? false;
      const {
        theme: nextTheme,
        source: nextSource,
        category: nextCategory,
      } = requestParamsRef.current;
      const offset = options.offset ?? 0;
      const nextSalt = append ? (options.salt ?? salt) : null;

      if (isBrowserOffline()) {
        setOffline(true);
        setLoading(false);
        setLoadingMore(false);
        setItems([]);
        setSalt(null);
        setError(null);
        return;
      }

      if (append && (inFlightRef.current || offset < nextOffsetRef.current)) {
        return;
      }
      if (!append) {
        requestGenRef.current += 1;
        nextOffsetRef.current = 0;
      }
      const requestGen = requestGenRef.current;
      inFlightRef.current = true;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setLoadingMore(false);
        setHasMore(true);
        setItems([]);
        setSalt(null);
      }
      setError(null);
      setOffline(false);

      try {
        const params = new URLSearchParams({
          count: String(PAGE_SIZE),
          source: nextSource,
          offset: String(offset),
          category: nextCategory,
        });
        if (nextTheme.trim()) {
          params.set("theme", nextTheme.trim());
        }
        if (nextSalt) {
          params.set("salt", nextSalt);
        }

        const res = await fetch(`/api/wallpapers?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error || `Request failed (${res.status}).`);
        }

        const data = (await res.json()) as WallpapersResponse;
        if (requestGen !== requestGenRef.current) {
          return;
        }
        const incoming = data.items;
        setSalt(data.salt);
        setItems((current) => {
          const extra = uniqueWallpapers(append ? current : [], incoming);
          return append ? [...current, ...extra] : extra;
        });
        nextOffsetRef.current = append
          ? Math.max(nextOffsetRef.current, offset + incoming.length)
          : incoming.length;
        setHasMore((data.hasMore ?? incoming.length >= PAGE_SIZE) && incoming.length > 0);
      } catch (err) {
        if (requestGen !== requestGenRef.current) {
          return;
        }
        if (isNetworkError(err)) {
          setOffline(true);
          setError(null);
          setItems([]);
          setSalt(null);
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong.");
        if (!append) {
          setItems([]);
          setSalt(null);
        }
      } finally {
        if (requestGen === requestGenRef.current) {
          inFlightRef.current = false;
          if (append) {
            setLoadingMore(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [salt]
  );

  const generate = useCallback(
    (overrides?: {
      theme?: string;
      source?: WallpaperSource;
      category?: QuoteCategory;
    }) => {
      if (overrides?.theme !== undefined) {
        setTheme(overrides.theme);
      }
      if (overrides?.source !== undefined) {
        setSource(overrides.source);
      }
      if (overrides?.category !== undefined) {
        setCategory(overrides.category);
      }
      requestParamsRef.current = {
        theme: overrides?.theme ?? theme,
        source: overrides?.source ?? source,
        category: overrides?.category ?? category,
      };
      void fetchWallpapers({ append: false, offset: 0 });
    },
    [fetchWallpapers, source, theme, category]
  );

  useEffect(() => {
    if (didInit.current) {
      return;
    }
    didInit.current = true;
    // Restore the previously selected category (if any) before the first load.
    const stored = readStoredCategory();
    if (stored && stored !== "any") {
      setCategory(stored);
      requestParamsRef.current = { ...requestParamsRef.current, category: stored };
    }
    if (isBrowserOffline()) {
      setOffline(true);
      setLoading(false);
      return;
    }
    void fetchWallpapers({ append: false, offset: 0 });
  }, [fetchWallpapers]);

  // Persist the chosen category so it's restored on the next visit.
  useEffect(() => {
    try {
      window.localStorage.setItem(CATEGORY_STORAGE_KEY, category);
    } catch {
      // ignore (private mode / storage disabled)
    }
  }, [category]);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      void fetchWallpapers({ append: false, offset: 0 });
    };
    const handleOffline = () => {
      setOffline(true);
      setLoading(false);
      setLoadingMore(false);
      setItems([]);
      setSalt(null);
      setError(null);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchWallpapers]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || items.length === 0 || offline) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          !entry?.isIntersecting ||
          loading ||
          loadingMore ||
          !hasMore ||
          !salt
        ) {
          return;
        }
        void fetchWallpapers({ append: true, offset: nextOffsetRef.current, salt });
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchWallpapers, hasMore, items.length, loading, loadingMore, offline, salt]);

  if (offline) {
    return (
      <NoInternetPage
        onRetry={() => {
          void fetchWallpapers({ append: false, offset: 0 });
        }}
      />
    );
  }

  const showInitialSkeleton = loading && items.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Quote wallpapers
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">
          Pick a theme and generate meaningful wallpapers — AI-painted or stock
          photos — each paired with a live quote. Scroll down to load more
          unique quotes, and download any as a ready-to-use image.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          generate();
        }}
        className="card space-y-4"
      >
        <div>
          <label htmlFor="wallpaper-theme" className="field-label">
            Theme
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="wallpaper-theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              placeholder="e.g. misty mountains at sunrise"
              maxLength={80}
              className="field-input flex-1"
            />
            <button type="submit" className="btn-primary shrink-0" disabled={loading}>
              {loading ? "Fetching quotes…" : "Generate wallpapers"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Each image is picked to match its quote&apos;s meaning. Add a theme
            to blend in a scene, or leave it blank.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {THEME_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  generate({ theme: suggestion });
                }}
                className={`chip ${
                  theme === suggestion ? "chip-active" : ""
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Style</span>
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200">
            {(["ai", "photo"] as WallpaperSource[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  generate({ source: option });
                }}
                className={`px-4 py-1.5 text-sm font-semibold transition ${
                  source === option
                    ? "bg-teal-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option === "ai" ? "AI art" : "Stock photo"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Quotes
          </span>
          <div className="flex flex-wrap gap-2">
            {QUOTE_CATEGORIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  generate({ category: option.value });
                }}
                className={`chip ${
                  category === option.value ? "chip-active" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showInitialSkeleton ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <WallpaperSkeleton key={index} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((wallpaper) => (
              <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} />
            ))}
            {loadingMore &&
              Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <WallpaperSkeleton key={`loading-more-${index}`} />
              ))}
          </div>

          {!loading && items.length === 0 && !error && (
            <div className="card text-center text-sm text-slate-600">
              No live quotes matched this category. Try another one.
            </div>
          )}

          <div ref={sentinelRef} className="h-px" aria-hidden />
        </>
      )}

      <p className="text-center text-xs text-slate-400">
        AI art via Pollinations · Stock photos via LoremFlickr · Quotes via
        ZenQuotes, DummyJSON &amp; QuotesOnDesign — all free.
      </p>
    </div>
  );
}
