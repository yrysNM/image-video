"use client";

import { useRef, useState } from "react";
import type { Wallpaper } from "@/lib/wallpapers";

interface WallpaperCardProps {
  wallpaper: Wallpaper;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

export function WallpaperCard({ wallpaper }: WallpaperCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        `“${wallpaper.quote}” — ${wallpaper.author}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("image load failed"));
        image.src = wallpaper.imageUrl;
      });

      const width = 1080;
      const height = 1440;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("no canvas context");
      }

      // Cover-fit the source image.
      const scale = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      ctx.drawImage(
        image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );

      // Readability scrim.
      const gradient = ctx.createLinearGradient(0, height * 0.35, 0, height);
      gradient.addColorStop(0, "rgba(2, 6, 23, 0)");
      gradient.addColorStop(0.55, "rgba(2, 6, 23, 0.45)");
      gradient.addColorStop(1, "rgba(2, 6, 23, 0.85)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Quote text.
      const margin = 90;
      const maxWidth = width - margin * 2;
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = 12;
      ctx.font = "600 58px Georgia, 'Times New Roman', serif";
      const lines = wrapLines(ctx, `“${wallpaper.quote}”`, maxWidth);
      const lineHeight = 74;
      const authorGap = 64;
      const blockHeight = lines.length * lineHeight + authorGap;
      let y = height - 140 - blockHeight + lineHeight;
      for (const line of lines) {
        ctx.fillText(line, width / 2, y);
        y += lineHeight;
      }

      // Author.
      ctx.shadowBlur = 8;
      ctx.font = "500 34px Georgia, 'Times New Roman', serif";
      ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
      ctx.fillText(`— ${wallpaper.author}`, width / 2, y + 8);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) {
        throw new Error("toBlob failed");
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const slug =
        (wallpaper.theme || "wallpaper")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "wallpaper";
      link.download = `${slug}-${wallpaper.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open the raw image so the user can still save it.
      window.open(wallpaper.imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <figure className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-sm shadow-slate-200/60">
      <div className="relative aspect-[3/4] w-full">
        {!loaded && !failed && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 to-slate-300" />
        )}
        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 px-6 text-center text-sm text-slate-300">
            Couldn&apos;t load this image. Try generating again.
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={wallpaper.imageUrl}
            alt={wallpaper.theme ? `${wallpaper.theme} wallpaper` : "Wallpaper"}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition duration-700 ${
              loaded ? "scale-100 opacity-100" : "scale-105 opacity-0"
            } group-hover:scale-105`}
          />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />

        <figcaption className="absolute inset-x-0 bottom-0 p-5">
          <blockquote
            className="text-balance text-lg font-semibold leading-snug text-white drop-shadow-md sm:text-xl"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            &ldquo;{wallpaper.quote}&rdquo;
          </blockquote>
          <p className="mt-2 text-sm font-medium text-slate-200/90">
            &mdash; {wallpaper.author}
          </p>

          <div className="pointer-events-auto mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || failed}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading ? "Preparing…" : "Download"}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              {copied ? "Copied!" : "Copy quote"}
            </button>
          </div>
        </figcaption>

        <span className="absolute left-3 top-3 rounded-full bg-slate-950/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
          {wallpaper.source === "ai" ? "AI art" : "Photo"}
        </span>
      </div>
    </figure>
  );
}
