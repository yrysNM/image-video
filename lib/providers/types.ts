import type { AspectRatioOption, DurationOption } from "../types";

export interface ImageToVideoInput {
  imageUrl: string;
  prompt: string;
  negativePrompt?: string;
  duration: DurationOption;
  aspectRatio: AspectRatioOption;
}

export type ProviderTaskStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export interface ProviderTaskResult {
  status: ProviderTaskStatus;
  videoUrl?: string;
  error?: string;
  errorCode?: "RATE_LIMIT" | "CONTENT_POLICY" | "TIMEOUT" | "PROVIDER";
}

export interface VideoProvider {
  readonly name: string;
  startImageToVideo(
    input: ImageToVideoInput
  ): Promise<{ externalTaskId: string }>;
  getTask(externalTaskId: string): Promise<ProviderTaskResult>;
}

export function mapDurationForRunway(duration: DurationOption): number {
  // gen4.5 accepts 2–10 seconds; map UI chips to nearest practical values
  if (duration === 4) return 4;
  if (duration === 6) return 6;
  return 10;
}

export function mapAspectRatioForRunway(
  aspectRatio: AspectRatioOption
): "1280:720" | "720:1280" | "960:960" {
  switch (aspectRatio) {
    case "9:16":
      return "720:1280";
    case "1:1":
      return "960:960";
    case "16:9":
    default:
      return "1280:720";
  }
}

export function mapDurationForKling(duration: DurationOption): "5" | "10" {
  if (duration <= 6) return "5";
  return "10";
}

export class ProviderError extends Error {
  readonly code: "RATE_LIMIT" | "CONTENT_POLICY" | "TIMEOUT" | "PROVIDER";

  constructor(
    message: string,
    code: "RATE_LIMIT" | "CONTENT_POLICY" | "TIMEOUT" | "PROVIDER" = "PROVIDER"
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

export function classifyProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : "Video provider request failed.";
  const lower = message.toLowerCase();

  if (
    lower.includes("rate") ||
    lower.includes("429") ||
    lower.includes("too many")
  ) {
    return new ProviderError(
      "The video provider is rate-limiting requests. Please wait and try again.",
      "RATE_LIMIT"
    );
  }
  if (
    lower.includes("forbidden") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("invalid api key") ||
    lower.includes("authentication")
  ) {
    return new ProviderError(
      "Provider rejected the API key (Forbidden). For fal.ai: add credits at https://fal.ai/dashboard/billing and confirm VIDEO_API_KEY at https://fal.ai/dashboard/keys, then restart the server.",
      "PROVIDER"
    );
  }
  if (
    lower.includes("content") ||
    lower.includes("policy") ||
    lower.includes("moderation") ||
    lower.includes("safety")
  ) {
    return new ProviderError(
      "The prompt or image was rejected by the provider content policy.",
      "CONTENT_POLICY"
    );
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return new ProviderError(
      "The video provider timed out. Please try again.",
      "TIMEOUT"
    );
  }

  return new ProviderError(message, "PROVIDER");
}
