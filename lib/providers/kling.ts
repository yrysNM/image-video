import {
  classifyProviderError,
  mapDurationForKling,
  ProviderError,
  type ImageToVideoInput,
  type ProviderTaskResult,
  type VideoProvider,
} from "./types";

const KLING_BASE_URL =
  process.env.KLING_API_BASE_URL || "https://api.kie.ai";

interface KlingCreateResponse {
  code?: number;
  msg?: string;
  data?: {
    taskId?: string;
  };
}

interface KlingStatusResponse {
  code?: number;
  msg?: string;
  data?: {
    taskId?: string;
    state?: string;
    resultJson?: string;
    failMsg?: string;
  };
}

function getApiKey(): string {
  const apiKey = process.env.VIDEO_API_KEY;
  if (!apiKey) {
    throw new ProviderError(
      "VIDEO_API_KEY is required for the Kling provider.",
      "PROVIDER"
    );
  }
  return apiKey;
}

function mapAspectForKling(aspectRatio: ImageToVideoInput["aspectRatio"]): string {
  return aspectRatio;
}

export class KlingProvider implements VideoProvider {
  readonly name = "kling";

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
      const response = await fetch(`${KLING_BASE_URL}/api/v1/jobs/createTask`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "kling-2.6/image-to-video",
          input: {
            prompt: input.prompt,
            negative_prompt: input.negativePrompt || undefined,
            image_urls: [input.imageUrl],
            duration: mapDurationForKling(input.duration),
            aspect_ratio: mapAspectForKling(input.aspectRatio),
          },
        }),
      });

      if (response.status === 429) {
        throw new ProviderError(
          "The video provider is rate-limiting requests. Please wait and try again.",
          "RATE_LIMIT"
        );
      }

      const payload = (await response.json()) as KlingCreateResponse;
      if (!response.ok) {
        throw new ProviderError(
          payload.msg || `Kling create failed (${response.status})`,
          "PROVIDER"
        );
      }

      const taskId = payload.data?.taskId;
      if (!taskId) {
        throw new ProviderError(
          "Kling did not return a task ID.",
          "PROVIDER"
        );
      }

      return { externalTaskId: taskId };
    } catch (error) {
      throw classifyProviderError(error);
    }
  }

  async getTask(externalTaskId: string): Promise<ProviderTaskResult> {
    try {
      const url = new URL(`${KLING_BASE_URL}/api/v1/jobs/recordInfo`);
      url.searchParams.set("taskId", externalTaskId);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
        },
      });

      if (response.status === 429) {
        return {
          status: "failed",
          error:
            "The video provider is rate-limiting requests. Please wait and try again.",
          errorCode: "RATE_LIMIT",
        };
      }

      const payload = (await response.json()) as KlingStatusResponse;
      if (!response.ok) {
        return {
          status: "failed",
          error: payload.msg || `Kling status failed (${response.status})`,
          errorCode: "PROVIDER",
        };
      }

      const state = (payload.data?.state || "").toLowerCase();
      if (state === "waiting" || state === "queuing" || state === "pending") {
        return { status: "pending" };
      }
      if (state === "generating" || state === "processing" || state === "running") {
        return { status: "running" };
      }
      if (state === "success" || state === "succeeded" || state === "completed") {
        let videoUrl: string | undefined;
        if (payload.data?.resultJson) {
          try {
            const parsed = JSON.parse(payload.data.resultJson) as {
              resultUrls?: string[];
            };
            videoUrl = parsed.resultUrls?.[0];
          } catch {
            videoUrl = undefined;
          }
        }
        if (!videoUrl) {
          return {
            status: "failed",
            error: "Kling returned success without a video URL.",
            errorCode: "PROVIDER",
          };
        }
        return { status: "succeeded", videoUrl };
      }

      const failMsg = payload.data?.failMsg || payload.msg || "Kling generation failed.";
      const classified = classifyProviderError(new Error(failMsg));
      return {
        status: "failed",
        error: classified.message,
        errorCode: classified.code,
      };
    } catch (error) {
      throw classifyProviderError(error);
    }
  }
}
