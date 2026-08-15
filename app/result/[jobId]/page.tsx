"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JobProgress } from "@/components/JobProgress";
import { VideoResult } from "@/components/VideoResult";
import type { ApiErrorBody, StatusResponse } from "@/lib/types";

export default function ResultPage() {
  const params = useParams();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";

  const [job, setJob] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const started = Date.now();

    const tickElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    };
    tickElapsed();
    const elapsedTimer = setInterval(tickElapsed, 1000);

    async function poll() {
      try {
        const response = await fetch(`/api/status/${jobId}`);
        const payload = (await response.json()) as StatusResponse | ApiErrorBody;
        if (!response.ok) {
          if (!cancelled) {
            setError(
              "error" in payload ? payload.error : "Failed to load status."
            );
          }
          return;
        }
        if ("jobId" in payload && !cancelled) {
          setJob(payload);
          setError(null);
          if (
            payload.status === "SUCCEEDED" ||
            payload.status === "FAILED"
          ) {
            clearInterval(pollTimer);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Network error while polling status.");
        }
      }
    }

    void poll();
    const pollTimer = setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      clearInterval(elapsedTimer);
    };
  }, [jobId]);

  if (!jobId) {
    return (
      <div className="card text-sm text-red-600">Missing job id.</div>
    );
  }

  if (error && !job) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <Link href="/" className="btn-secondary inline-flex">
          Back home
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <JobProgress status="PENDING" elapsedSeconds={elapsedSeconds} />
    );
  }

  if (job.status === "SUCCEEDED") {
    return <VideoResult job={job} />;
  }

  return (
    <div className="space-y-4">
      <JobProgress
        status={job.status}
        elapsedSeconds={elapsedSeconds}
        errorMessage={job.errorMessage}
      />
      {job.status === "FAILED" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/?imageUrl=${encodeURIComponent(job.imageUrl)}&prompt=${encodeURIComponent(job.prompt)}`}
            className="btn-primary"
          >
            Try again
          </Link>
          <Link href="/" className="btn-secondary">
            Start over
          </Link>
        </div>
      ) : null}
    </div>
  );
}
