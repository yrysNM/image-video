"use client";

import Link from "next/link";
import type { HistoryItem } from "@/lib/types";

interface HistoryListProps {
  items: HistoryItem[];
  loading: boolean;
  error: string | null;
}

function statusStyles(status: HistoryItem["status"]): string {
  switch (status) {
    case "SUCCEEDED":
      return "bg-teal-50 text-teal-800";
    case "FAILED":
      return "bg-red-50 text-red-700";
    case "PROCESSING":
    case "PENDING":
      return "bg-amber-50 text-amber-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function HistoryList({ items, loading, error }: HistoryListProps) {
  if (loading) {
    return (
      <div className="card text-sm text-slate-500">Loading history…</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-slate-700">No generations yet.</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Create your first video
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/result/${item.id}`}
            className="card flex gap-4 transition hover:border-teal-200 hover:shadow-md"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles(item.status)}`}
                >
                  {item.status}
                </span>
                <time className="text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="truncate text-sm font-medium text-slate-800">
                {item.prompt}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
