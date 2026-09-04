"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Wallpaper, WallpaperSource } from "@/lib/wallpapers";
import { QUOTE_CATEGORIES, type QuoteCategory } from "@/lib/quotes-data";
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

type WallpapersResponse = {
  items: Wallpaper[];
  salt: string;
  offset: number;
};

export function WallpaperGallery() {
  const [theme, setTheme] = useState("");
  const [source, setSource] = useState<WallpaperSource>("ai");
  const [category, setCategory] = useState<QuoteCategory>("any");
  const [items, setItems] = useState<Wallpaper[]>([]);
  const [salt, setSalt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didInit = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
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

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setHasMore(true);
      }
      setError(null);

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
        setSalt(data.salt);
        setHasMore(data.items.length >= PAGE_SIZE);
        setItems((current) => (append ? [...current, ...data.items] : data.items));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        if (!append) {
          setItems([]);
          setSalt(null);
        }
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
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
    const sentinel = sentinelRef.current;
    if (!sentinel || items.length === 0) {
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
        void fetchWallpapers({ append: true, offset: items.length, salt });
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchWallpapers, hasMore, items.length, loading, loadingMore, salt]);

  return (
    <div className="space-y-6">
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
              {loading ? "Generating…" : "Generate wallpapers"}
            </button>
          </div>
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

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <div
              key={index}
              className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-slate-200"
            />
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
                <div
                  key={`loading-more-${index}`}
                  className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-slate-200"
                />
              ))}
          </div>

          <div ref={sentinelRef} className="h-px" aria-hidden />
        </>
      )}

      <p className="text-center text-xs text-slate-400">
        AI art via Pollinations · Stock photos via LoremFlickr · Hand-picked
        quotes — all free.
      </p>
    </div>
  );
}
