import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { isAllowedImageUrl } from "@/lib/wallpapers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Same-origin proxy for wallpaper images from the allowlisted free hosts.
 * Serving them from our origin lets the client composite the photo + quote
 * onto a canvas for download without cross-origin tainting.
 */
export async function GET(request: Request): Promise<NextResponse | Response> {
  const src = new URL(request.url).searchParams.get("src");
  if (!src) {
    return jsonError("Missing image source.", 400, "VALIDATION");
  }
  if (!isAllowedImageUrl(src)) {
    return jsonError("Image host is not allowed.", 400, "VALIDATION");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const upstream = await fetch(src, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });

    if (!upstream.ok || !upstream.body) {
      return jsonError(
        `Upstream image request failed (${upstream.status}).`,
        502,
        "PROVIDER"
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return jsonError("Upstream did not return an image.", 502, "PROVIDER");
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch {
    return jsonError("Failed to load wallpaper image.", 504, "PROVIDER");
  } finally {
    clearTimeout(timeout);
  }
}
