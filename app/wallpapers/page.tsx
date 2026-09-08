import type { Metadata } from "next";
import { WallpaperGallery } from "@/components/WallpaperGallery";

export const metadata: Metadata = {
  title: "Wallpapers · ImageToVideo",
  description:
    "AI-generated and stock wallpapers paired with meaningful quotes — free to create and download.",
};

export default function WallpapersPage() {
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
          photos — each paired with an inspiring quote. Scroll down to load more
          unique quotes, and download any as a ready-to-use image.
        </p>
      </div>
      <WallpaperGallery />
    </div>
  );
}
