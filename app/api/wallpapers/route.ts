import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { buildWallpapers, type Wallpaper, type WallpaperSource } from "@/lib/wallpapers";

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

export async function GET(
  request: Request
): Promise<NextResponse<{ items: Wallpaper[] } | { error: string; code?: string }>> {
  try {
    const params = new URL(request.url).searchParams;
    const count = parseCount(params.get("count"));
    const theme = (params.get("theme") ?? "").slice(0, MAX_THEME_LENGTH);
    const source = parseSource(params.get("source"));
    const salt = Math.random().toString(36).slice(2, 8);

    const items = await buildWallpapers({ count, theme, source, salt });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/wallpapers", error);
    return jsonError("Failed to build wallpapers.", 500, "INTERNAL");
  }
}
