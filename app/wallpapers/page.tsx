import type { Metadata } from "next";
import { WallpaperGallery } from "@/components/WallpaperGallery";

export const metadata: Metadata = {
  title: "Wallpapers · ImageToVideo",
  description:
    "AI-generated and stock wallpapers paired with meaningful quotes — free to create and download.",
};

export default function WallpapersPage() {
  return <WallpaperGallery />;
}
