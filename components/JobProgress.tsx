"use client";

import type { GenerationStatusDto } from "@/lib/types";

interface JobProgressProps {
  status: GenerationStatusDto;
  elapsedSeconds: number;
  errorMessage?: string | null;
}

export function JobProgress({
  status,
  elapsedSeconds,
  errorMessage,
}: JobProgressProps) {
  const label =
    status === "PENDING"
      ? "Queued…"
      : status === "PROCESSING"
        ? "Generating video…"
        : status === "FAILED"
          ? "Generation failed"
          : "Complete";

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        {status === "PENDING" || status === "PROCESSING" ? (
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-teal-600" />
          </span>
        ) : null}
        <div>
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-slate-500">
            Elapsed {elapsedSeconds}s · typically 30s–3min with a live provider
          </p>
        </div>
      </div>

      {(status === "PENDING" || status === "PROCESSING") && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-teal-500" />
        </div>
      )}

      {errorMessage ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
