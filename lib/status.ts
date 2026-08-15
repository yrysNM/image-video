import type { GenerationStatusDto } from "./types";

const STATUSES: GenerationStatusDto[] = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
];

export function asGenerationStatus(value: string): GenerationStatusDto {
  if (STATUSES.includes(value as GenerationStatusDto)) {
    return value as GenerationStatusDto;
  }
  return "FAILED";
}
