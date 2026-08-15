import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "ImageToVideo",
  description: "Turn a still image and a motion prompt into a short AI video.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-16 pt-8 sm:px-6">
          <header className="mb-10 flex items-center justify-between gap-4">
            <Link href="/" className="group">
              <p
                className="text-2xl font-semibold tracking-tight text-slate-900"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                ImageToVideo
              </p>
              <p className="text-sm text-slate-500 group-hover:text-teal-700">
                Still image → short motion clip
              </p>
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/" className="btn-secondary px-3 py-2 text-xs sm:text-sm">
                New
              </Link>
              <Link
                href="/history"
                className="btn-secondary px-3 py-2 text-xs sm:text-sm"
              >
                History
              </Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
