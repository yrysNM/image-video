import { readFile } from "fs/promises";
import path from "path";
import { ApiError, fal } from "@fal-ai/client";
import {
  classifyProviderError,
  ProviderError,
  type ImageToVideoInput,
  type ProviderTaskResult,
  type VideoProvider,
} from "./types";

const FAL_MODEL = "fal-ai/stable-video";

function getFalKey(): string {
  const apiKey = (process.env.VIDEO_API_KEY || process.env.FAL_KEY || "").trim();
  if (!apiKey) {
    throw new ProviderError(
      "VIDEO_API_KEY (or FAL_KEY) is required for the fal provider. Get a key at https://fal.ai/dashboard/keys",
      "PROVIDER"
    );
  }
  return apiKey;
}

function configureFal(): void {
  const key = getFalKey();
  // fal SDK also reads FAL_KEY from the environment in some code paths
  process.env.FAL_KEY = key;
  fal.config({ credentials: key });
}

function mapFalError(error: unknown): ProviderError {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return new ProviderError(
        "fal.ai returned Forbidden — usually no account credits or an invalid key. Add credits at https://fal.ai/dashboard/billing, verify the key at https://fal.ai/dashboard/keys, then restart npm run dev.",
        "PROVIDER"
      );
    }
    const detail =
      typeof error.body === "object" &&
      error.body !== null &&
      "detail" in error.body &&
      typeof (error.body as { detail: unknown }).detail === "string"
        ? (error.body as { detail: string }).detail
        : error.message;
    return classifyProviderError(new Error(`fal.ai (${error.status}): ${detail}`));
  }
  return classifyProviderError(error);
}

function isLocalOrRelativeUrl(imageUrl: string): boolean {
  if (imageUrl.startsWith("/")) return true;
  try {
    const parsed = new URL(imageUrl);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    );
  } catch {
    return true;
  }
}

function localPathFromUrl(imageUrl: string): string {
  let pathname = imageUrl;
  try {
    pathname = new URL(imageUrl).pathname;
  } catch {
    pathname = imageUrl;
  }
  const relative = pathname.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", relative);
}

function mimeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

async function resolveImageUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }
  if (!isLocalOrRelativeUrl(imageUrl)) {
    return imageUrl;
  }

  const filePath = localPathFromUrl(imageUrl);
  const bytes = await readFile(filePath);
  const mime = mimeFromPath(filePath);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function motionBucketForDuration(duration: ImageToVideoInput["duration"]): number {
  if (duration <= 4) return 80;
  if (duration <= 6) return 127;
  return 180;
}

interface FalStableVideoOutput {
  video: {
    url: string;
  };
}

export class FalProvider implements VideoProvider {
  readonly name = "fal";

  async startImageToVideo(
    input: ImageToVideoInput
  ): Promise<{ externalTaskId: string }> {
    if (input.collaborative) {
      throw new ProviderError(
        "Collaborative mode is only supported with Runway (VIDEO_API_PROVIDER=runway).",
        "PROVIDER"
      );
    }
    try {
      configureFal();
      const imageUrl = await resolveImageUrl(input.imageUrl);

      const submitted = await fal.queue.submit(FAL_MODEL, {
        input: {
          image_url: imageUrl,
          motion_bucket_id: motionBucketForDuration(input.duration),
          cond_aug: input.prompt.trim().length > 40 ? 0.05 : 0.02,
          fps: 25,
        },
      });

      if (!submitted.request_id) {
        throw new ProviderError(
          "fal.ai did not return a request id.",
          "PROVIDER"
        );
      }

      return { externalTaskId: submitted.request_id };
    } catch (error) {
      throw mapFalError(error);
    }
  }

  async getTask(externalTaskId: string): Promise<ProviderTaskResult> {
    try {
      configureFal();

      const status = await fal.queue.status(FAL_MODEL, {
        requestId: externalTaskId,
        logs: false,
      });

      if (status.status === "IN_QUEUE") {
        return { status: "pending" };
      }
      if (status.status === "IN_PROGRESS") {
        return { status: "running" };
      }

      if (status.status === "COMPLETED") {
        const result = await fal.queue.result(FAL_MODEL, {
          requestId: externalTaskId,
        });
        const data = result.data as FalStableVideoOutput;
        const videoUrl = data.video?.url;
        if (!videoUrl) {
          return {
            status: "failed",
            error: "fal.ai returned success without a video URL.",
            errorCode: "PROVIDER",
          };
        }
        return { status: "succeeded", videoUrl };
      }

      return { status: "running" };
    } catch (error) {
      throw mapFalError(error);
    }
  }
}
