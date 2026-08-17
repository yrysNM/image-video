import type { AspectRatioOption, DurationOption } from "./types";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES = 8;
export const COLLABORATIVE_IMAGE_COUNT = 3;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export const SINGLE_DURATION_OPTIONS: DurationOption[] = [4, 6, 10];
export const COLLABORATIVE_DURATION_OPTIONS: DurationOption[] = [15, 20, 30];
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  "16:9",
  "9:16",
  "1:1",
];

export function isCollaborativeDuration(
  value: unknown
): value is DurationOption {
  return value === 15 || value === 20 || value === 30;
}

export function isSingleDuration(value: unknown): value is DurationOption {
  return value === 4 || value === 6 || value === 10;
}

export function isDurationOption(value: unknown): value is DurationOption {
  return isSingleDuration(value) || isCollaborativeDuration(value);
}

export function isCollaborativeRequest(
  imageCount: number,
  duration: DurationOption
): boolean {
  return imageCount === COLLABORATIVE_IMAGE_COUNT && isCollaborativeDuration(duration);
}

export function isAspectRatioOption(value: unknown): value is AspectRatioOption {
  return value === "16:9" || value === "9:16" || value === "1:1";
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Only JPG and PNG images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 10MB or smaller.";
  }
  return null;
}

export function validatePrompt(prompt: string): string | null {
  if (!prompt.trim()) {
    return "Prompt cannot be empty.";
  }
  return null;
}

export function validateGenerationRequest(
  imageCount: number,
  duration: DurationOption
): string | null {
  if (imageCount === 0) {
    return "Please upload at least one image.";
  }
  if (isCollaborativeDuration(duration)) {
    if (imageCount !== COLLABORATIVE_IMAGE_COUNT) {
      return `Collaborative ${duration}s video requires exactly ${COLLABORATIVE_IMAGE_COUNT} images.`;
    }
    return null;
  }
  if (imageCount === COLLABORATIVE_IMAGE_COUNT) {
    return "Three images require a collaborative duration (15s, 20s, or 30s).";
  }
  return null;
}
