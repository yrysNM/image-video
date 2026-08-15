"use client";

import { useEffect, useState } from "react";
import { HistoryList } from "@/components/HistoryList";
import type { ApiErrorBody, HistoryItem, HistoryResponse } from "@/lib/types";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/history");
        const payload = (await response.json()) as
          | HistoryResponse
          | ApiErrorBody;
        if (!response.ok) {
          if (!cancelled) {
            setError(
              "error" in payload ? payload.error : "Failed to load history."
            );
          }
          return;
        }
        if ("items" in payload && !cancelled) {
          setItems(payload.items);
        }
      } catch {
        if (!cancelled) {
          setError("Network error while loading history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          History
        </h1>
        <p className="mt-2 text-slate-600">
          Past generations for this browser session.
        </p>
      </div>
      <HistoryList items={items} loading={loading} error={error} />
    </div>
  );
}
