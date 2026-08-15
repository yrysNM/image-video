export type DurationOption = 4 | 6 | 10;
export type AspectRatioOption = "16:9" | "9:16" | "1:1";
export type ProviderName = "mock" | "runway" | "kling" | "fal";

export type GenerationStatusDto =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED";

export interface GenerateResponse {
  jobId: string;
}

export interface StatusResponse {
  jobId: string;
  status: GenerationStatusDto;
  prompt: string;
  negativePrompt: string | null;
  duration: number;
  aspectRatio: string;
  imageUrl: string;
  videoUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryItem {
  id: string;
  status: GenerationStatusDto;
  prompt: string;
  imageUrl: string;
  videoUrl: string | null;
  createdAt: string;
  duration: number;
  aspectRatio: string;
}

export interface HistoryResponse {
  items: HistoryItem[];
}

export interface ApiErrorBody {
  error: string;
  code?:
    | "VALIDATION"
    | "RATE_LIMIT"
    | "CONTENT_POLICY"
    | "TIMEOUT"
    | "NOT_FOUND"
    | "PROVIDER"
    | "INTERNAL";
}
