"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PromptFormFields } from "@/components/PromptFormFields";
import {
  UploadDropzone,
  type UploadItem,
} from "@/components/UploadDropzone";
import type {
  ApiErrorBody,
  AspectRatioOption,
  DurationOption,
  GenerateResponse,
} from "@/lib/types";
import {
  COLLABORATIVE_IMAGE_COUNT,
  isAspectRatioOption,
  isCollaborativeDuration,
  isDurationOption,
  isSingleDuration,
  MAX_IMAGES,
  validateGenerationRequest,
  validatePrompt,
} from "@/lib/validation";

function newItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function GenerateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialImageUrl = searchParams.get("imageUrl");
  const initialPrompt = searchParams.get("prompt") ?? "";
  const initialNegative = searchParams.get("negativePrompt") ?? "";
  const initialDurationRaw = Number(searchParams.get("duration") ?? 6);
  const initialAspect = searchParams.get("aspectRatio") ?? "16:9";

  const [items, setItems] = useState<UploadItem[]>(() =>
    initialImageUrl
      ? [
          {
            id: newItemId(),
            url: initialImageUrl,
            name: "Previous image",
          },
        ]
      : []
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const [negativePrompt, setNegativePrompt] = useState(initialNegative);
  const [duration, setDuration] = useState<DurationOption>(() => {
    if (isDurationOption(initialDurationRaw)) return initialDurationRaw;
    return 6;
  });
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(
    isAspectRatioOption(initialAspect) ? initialAspect : "16:9"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collaborative = items.length === COLLABORATIVE_IMAGE_COUNT;

  useEffect(() => {
    const blobUrls = items
      .filter((item) => item.file)
      .map((item) => item.url);
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [items]);

  useEffect(() => {
    if (collaborative && isSingleDuration(duration)) {
      setDuration(15);
    } else if (!collaborative && isCollaborativeDuration(duration)) {
      setDuration(6);
    }
  }, [collaborative, duration]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const promptError = validatePrompt(prompt);
    if (promptError) {
      setError(promptError);
      return;
    }

    const requestError = validateGenerationRequest(items.length, duration);
    if (requestError) {
      setError(requestError);
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("negativePrompt", negativePrompt);
      form.set("duration", String(duration));
      form.set("aspectRatio", aspectRatio);

      for (const item of items) {
        if (item.file) {
          form.append("images", item.file);
        } else {
          form.append("imageUrl", item.url);
        }
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

      if (payload.jobIds.length > 1) {
        router.push("/history");
        return;
      }

      router.push(`/result/${payload.jobId}`);
    } catch {
      setError("Network error while starting generation.");
    } finally {
      setSubmitting(false);
    }
  }

  const generateLabel = collaborative
    ? `Generate collaborative ${duration}s video`
    : items.length > 1
      ? `Generate ${items.length} videos`
      : "Generate Video";

  return (
    <form onSubmit={onSubmit} className="card space-y-6">
      <UploadDropzone
        items={items}
        disabled={submitting}
        collaborative={collaborative}
        onAddFiles={(files) => {
          setItems((current) => {
            const room = MAX_IMAGES - current.length;
            const next = files.slice(0, room).map((file) => ({
              id: newItemId(),
              file,
              url: URL.createObjectURL(file),
              name: file.name,
            }));
            return [...current, ...next];
          });
        }}
        onRemove={(id) => {
          setItems((current) => {
            const removed = current.find((item) => item.id === id);
            if (removed?.file) {
              URL.revokeObjectURL(removed.url);
            }
            return current.filter((item) => item.id !== id);
          });
        }}
      />

      {collaborative ? (
        <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Three images will be blended into one collaborative video using Runway
          Seedance 2. Choose 15s, 20s, or 30s.
        </p>
      ) : items.length > 1 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Upload exactly 3 images to create one collaborative 15–30s video. With{" "}
          {items.length} images, each will generate a separate clip.
        </p>
      ) : null}

      <PromptFormFields
        prompt={prompt}
        negativePrompt={negativePrompt}
        duration={duration}
        aspectRatio={aspectRatio}
        collaborative={collaborative}
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

      <button
        type="submit"
        className="btn-primary w-full sm:w-auto"
        disabled={submitting}
      >
        {submitting ? "Starting…" : generateLabel}
      </button>
    </form>
  );
}
