import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { buildWallpapers, quotePoolSize, type Wallpaper, type WallpaperSource } from "@/lib/wallpapers";
import { QUOTE_CATEGORIES, type QuoteCategory } from "@/lib/quotes-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_COUNT = 1;
const MAX_COUNT = 12;
const MAX_THEME_LENGTH = 80;

function parseCount(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 6;
  }
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(value)));
}

function parseSource(raw: string | null): WallpaperSource {
  return raw === "photo" ? "photo" : "ai";
}

function parseOffset(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

function parseCategory(raw: string | null): QuoteCategory {
  const value = (raw ?? "").toLowerCase();
  const match = QUOTE_CATEGORIES.find((c) => c.value === value);
  return match ? match.value : "any";
}

function parseSalt(raw: string | null): string | undefined {
  const value = raw?.trim();
  if (!value || !/^[a-z0-9]{4,12}$/i.test(value)) {
    return undefined;
  }
  return value;
}

export async function GET(
  request: Request
): Promise<
  NextResponse<
    { items: Wallpaper[]; salt: string; offset: number; hasMore: boolean } | { error: string; code?: string }
  >
> {
  try {
    const params = new URL(request.url).searchParams;
    const count = parseCount(params.get("count"));
    const theme = (params.get("theme") ?? "").slice(0, MAX_THEME_LENGTH);
    const source = parseSource(params.get("source"));
    const offset = parseOffset(params.get("offset"));
    const category = parseCategory(params.get("category"));
    const salt = parseSalt(params.get("salt")) ?? Math.random().toString(36).slice(2, 8);

    const items = await buildWallpapers({ count, theme, source, salt, offset, category });
    const hasMore = offset + items.length < (await quotePoolSize(category));
    return NextResponse.json({ items, salt, offset, hasMore });
  } catch (error) {
    console.error("GET /api/wallpapers", error);
    const message = error instanceof Error ? error.message : "";
    if (/quotes could not be fetched/i.test(message)) {
      return jsonError("Quotes are unavailable right now. Please try again.", 503, "INTERNAL");
    }
    return jsonError("Failed to build wallpapers.", 500, "INTERNAL");
  }
}
