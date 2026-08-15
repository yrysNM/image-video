"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PromptFormFields } from "@/components/PromptFormFields";
import { UploadDropzone } from "@/components/UploadDropzone";
import type {
  ApiErrorBody,
  AspectRatioOption,
  DurationOption,
  GenerateResponse,
} from "@/lib/types";
import {
  isAspectRatioOption,
  isDurationOption,
  validatePrompt,
} from "@/lib/validation";

export function GenerateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialImageUrl = searchParams.get("imageUrl");
  const initialPrompt = searchParams.get("prompt") ?? "";
  const initialNegative = searchParams.get("negativePrompt") ?? "";
  const initialDurationRaw = Number(searchParams.get("duration") ?? 6);
  const initialAspect = searchParams.get("aspectRatio") ?? "16:9";

  const [file, setFile] = useState<File | null>(null);
  const [reuseImageUrl, setReuseImageUrl] = useState<string | null>(
    initialImageUrl
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const [negativePrompt, setNegativePrompt] = useState(initialNegative);
  const [duration, setDuration] = useState<DurationOption>(
    isDurationOption(initialDurationRaw) ? initialDurationRaw : 6
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(
    isAspectRatioOption(initialAspect) ? initialAspect : "16:9"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return reuseImageUrl;
  }, [file, reuseImageUrl]);

  useEffect(() => {
    if (!file || !previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [file, previewUrl]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const promptError = validatePrompt(prompt);
    if (promptError) {
      setError(promptError);
      return;
    }
    if (!file && !reuseImageUrl) {
      setError("Please upload an image.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("negativePrompt", negativePrompt);
      form.set("duration", String(duration));
      form.set("aspectRatio", aspectRatio);
      if (file) {
        form.set("image", file);
      } else if (reuseImageUrl) {
        form.set("imageUrl", reuseImageUrl);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: form,
      });

      const payload = (await response.json()) as
        | GenerateResponse
        | ApiErrorBody;

      if (!response.ok) {
        const message =
          "error" in payload ? payload.error : "Failed to start generation.";
        setError(message);
        return;
      }

      if (!("jobId" in payload)) {
        setError("Unexpected response from server.");
        return;
      }

      router.push(`/result/${payload.jobId}`);
    } catch {
      setError("Network error while starting generation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-6">
      <UploadDropzone
        file={file}
        previewUrl={previewUrl}
        disabled={submitting}
        onFileChange={(next) => {
          setFile(next);
          if (next) setReuseImageUrl(null);
        }}
      />

      {!file && reuseImageUrl ? (
        <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Reusing previous image. Upload a new file to replace it.
        </p>
      ) : null}

      <PromptFormFields
        prompt={prompt}
        negativePrompt={negativePrompt}
        duration={duration}
        aspectRatio={aspectRatio}
        onPromptChange={setPrompt}
        onNegativePromptChange={setNegativePrompt}
        onDurationChange={setDuration}
        onAspectRatioChange={setAspectRatio}
        disabled={submitting}
      />

      {error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={submitting}>
        {submitting ? "Starting…" : "Generate Video"}
      </button>
    </form>
  );
}
