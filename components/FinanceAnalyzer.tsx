"use client";

import { useRef, useState } from "react";
import type { FinanceAnalysis } from "@/lib/finance/analyze";
import { SAMPLE_STATEMENT } from "@/lib/finance/sample";
import { FinanceResults } from "./FinanceResults";

type Status =
  | { kind: "idle" }
  | { kind: "reading"; label: string }
  | { kind: "analyzing" }
  | { kind: "done" }
  | { kind: "error"; message: string };

async function analyzeText(text: string): Promise<FinanceAnalysis> {
  const res = await fetch("/api/finance/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body = (await res.json().catch(() => null)) as
    | { analysis?: FinanceAnalysis; error?: string }
    | null;
  if (!res.ok || !body?.analysis) {
    throw new Error(body?.error || `Analysis failed (${res.status}).`);
  }
  return body.analysis;
}

async function analyzePdf(file: File): Promise<FinanceAnalysis> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/finance/analyze", { method: "POST", body: form });
  const body = (await res.json().catch(() => null)) as
    | { analysis?: FinanceAnalysis; error?: string }
    | null;
  if (!res.ok || !body?.analysis) {
    throw new Error(body?.error || `Analysis failed (${res.status}).`);
  }
  return body.analysis;
}

export function FinanceAnalyzer() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [ocrProgress, setOcrProgress] = useState(0);
  const [analysis, setAnalysis] = useState<FinanceAnalysis | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runImageOcr(file: File): Promise<string> {
    setStatus({ kind: "reading", label: "Reading screenshot with OCR" });
    setOcrProgress(0);
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          setOcrProgress(Math.round(m.progress * 100));
        }
      },
    });
    try {
      const {
        data: { text },
      } = await worker.recognize(file);
      return text;
    } finally {
      await worker.terminate();
    }
  }

  async function handleFile(file: File) {
    setAnalysis(null);
    try {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/");

      let result: FinanceAnalysis;
      if (isPdf) {
        setStatus({ kind: "reading", label: "Extracting text from PDF" });
        result = await analyzePdf(file);
      } else if (isImage) {
        const text = await runImageOcr(file);
        setStatus({ kind: "analyzing" });
        result = await analyzeText(text);
      } else {
        throw new Error("Please upload a PNG/JPG screenshot or a PDF statement.");
      }
      setAnalysis(result);
      setStatus({ kind: "done" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  async function handleSample() {
    setAnalysis(null);
    setStatus({ kind: "analyzing" });
    try {
      const result = await analyzeText(SAMPLE_STATEMENT);
      setAnalysis(result);
      setStatus({ kind: "done" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  const busy = status.kind === "reading" || status.kind === "analyzing";

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging
              ? "border-teal-400 bg-teal-50"
              : "border-slate-300 bg-slate-50 hover:border-teal-300 hover:bg-slate-100"
          }`}
        >
          <p className="text-sm font-medium text-slate-700">
            Drop a bank screenshot or PDF here, or click to choose
          </p>
          <p className="mt-1 text-xs text-slate-400">
            PNG / JPG screenshots are read with on-device OCR · PDFs are parsed for text
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSample}
            disabled={busy}
            className="btn-secondary"
          >
            Try a sample statement
          </button>
          {busy && (
            <span className="text-sm text-slate-500">
              {status.kind === "reading" ? status.label : "Analyzing"}
              {status.kind === "reading" && ocrProgress > 0 ? ` … ${ocrProgress}%` : "…"}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Your document is processed only to extract transactions. Images never leave
          your browser; PDFs are sent to the app only to read their text.
        </p>
      </div>

      {status.kind === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {status.message}
        </div>
      )}

      {analysis && <FinanceResults analysis={analysis} />}
    </div>
  );
}
