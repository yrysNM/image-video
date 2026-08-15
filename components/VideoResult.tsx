"use client";

import Link from "next/link";
import type { StatusResponse } from "@/lib/types";

interface VideoResultProps {
  job: StatusResponse;
}

export function VideoResult({ job }: VideoResultProps) {
  const regenerateHref = `/?imageUrl=${encodeURIComponent(job.imageUrl)}&prompt=${encodeURIComponent(job.prompt)}&negativePrompt=${encodeURIComponent(job.negativePrompt ?? "")}&duration=${job.duration}&aspectRatio=${encodeURIComponent(job.aspectRatio)}`;

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        {job.videoUrl ? (
          <video
            src={job.videoUrl}
            controls
            playsInline
            className="aspect-video w-full bg-slate-900"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-slate-100 text-sm text-slate-500">
            No video URL available
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <p className="text-sm text-slate-500">Prompt</p>
        <p className="text-slate-800">{job.prompt}</p>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-lg bg-slate-100 px-2 py-1">
            {job.duration}s
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1">
            {job.aspectRatio}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {job.videoUrl ? (
          <a
            href={job.videoUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Download video
          </a>
        ) : null}
        <Link href={regenerateHref} className="btn-secondary">
          Regenerate with new prompt
        </Link>
        <Link href="/" className="btn-secondary">
          Start over
        </Link>
      </div>
    </div>
  );
}
