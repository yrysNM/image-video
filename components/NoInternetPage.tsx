"use client";

interface NoInternetPageProps {
  onRetry: () => void;
}

export function NoInternetPage({ onRetry }: NoInternetPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-md text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 8.82A15 15 0 0 1 12 5c2.5 0 4.85.6 6.93 1.66" />
            <path d="M5 12.36A11 11 0 0 1 12 10c1.7 0 3.3.38 4.73 1.06" />
            <path d="M8.5 15.8A6 6 0 0 1 12 15c.9 0 1.74.2 2.5.55" />
            <path d="M12 20h.01" />
            <path d="M3 3l18 18" />
          </svg>
        </div>
        <h1
          className="mt-5 text-2xl font-semibold tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          No internet
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Quotes are loaded live and need a connection. Check your Wi‑Fi or
          mobile data, then try again.
        </p>
        <button type="button" onClick={onRetry} className="btn-primary mt-6">
          Try again
        </button>
      </div>
    </div>
  );
}
