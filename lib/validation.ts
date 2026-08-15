import type { AspectRatioOption, DurationOption } from "./types";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export const DURATION_OPTIONS: DurationOption[] = [4, 6, 10];
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  "16:9",
  "9:16",
  "1:1",
];

export function isDurationOption(value: unknown): value is DurationOption {
  return value === 4 || value === 6 || value === 10;
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
  if (prompt.trim().length > 1000) {
    return "Prompt must be 1000 characters or fewer.";
  }
  return null;
}
