"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Wallpaper, WallpaperSource } from "@/lib/wallpapers";
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

const COUNT_OPTIONS = [3, 6, 9];

export function WallpaperGallery() {
  const [theme, setTheme] = useState("");
  const [source, setSource] = useState<WallpaperSource>("ai");
  const [count, setCount] = useState(6);
  const [items, setItems] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didInit = useRef(false);

  const generate = useCallback(
    async (overrides?: { theme?: string; source?: WallpaperSource; count?: number }) => {
      const nextTheme = overrides?.theme ?? theme;
      const nextSource = overrides?.source ?? source;
      const nextCount = overrides?.count ?? count;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          count: String(nextCount),
          source: nextSource,
        });
        if (nextTheme.trim()) {
          params.set("theme", nextTheme.trim());
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
        const data = (await res.json()) as { items: Wallpaper[] };
        setItems(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [theme, source, count]
  );

  useEffect(() => {
    if (didInit.current) {
      return;
    }
    didInit.current = true;
    void generate();
  }, [generate]);

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
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
                  setTheme(suggestion);
                  void generate({ theme: suggestion });
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Style</span>
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-200">
              {(["ai", "photo"] as WallpaperSource[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSource(option);
                    void generate({ source: option });
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

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Count</span>
            <div className="flex gap-1.5">
              {COUNT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCount(option);
                    void generate({ count: option });
                  }}
                  className={`chip ${count === option ? "chip-active" : ""}`}
                >
                  {option}
                </button>
              ))}
            </div>
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
          {Array.from({ length: count }).map((_, index) => (
            <div
              key={index}
              className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((wallpaper) => (
            <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        AI art via Pollinations · Stock photos via Lorem Picsum · Quotes via
        ZenQuotes — all free.
      </p>
    </div>
  );
}
