import { readFile } from "fs/promises";
import path from "path";
import RunwayML, { TaskFailedError, toFile } from "@runwayml/sdk";
import {
  classifyProviderError,
  mapAspectRatioForRunway,
  mapDurationForRunway,
  ProviderError,
  type ImageToVideoInput,
  type ProviderTaskResult,
  type VideoProvider,
} from "./types";

function getClient(): RunwayML {
  const apiKey = process.env.VIDEO_API_KEY;
  if (!apiKey) {
    throw new ProviderError(
      "VIDEO_API_KEY is required for the Runway provider. Set it in .env and restart the server.",
      "PROVIDER"
    );
  }
  return new RunwayML({ apiKey });
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

/**
 * Runway cannot fetch localhost URLs. Upload local files via ephemeral upload
 * (or pass through public HTTPS URLs unchanged).
 */
async function resolvePromptImage(
  client: RunwayML,
  imageUrl: string
): Promise<string> {
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("runway://")) {
    return imageUrl;
  }

  if (!isLocalOrRelativeUrl(imageUrl)) {
    return imageUrl;
  }

  const filePath = localPathFromUrl(imageUrl);
  const bytes = await readFile(filePath);
  const mime = mimeFromPath(filePath);
  const filename = path.basename(filePath);

  // Prefer data URI for smaller images (Runway limit ~5MB for data URIs)
  if (bytes.byteLength <= 4.5 * 1024 * 1024) {
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }

  const file = await toFile(bytes, filename, { type: mime });
  const uploaded = await client.uploads.createEphemeral({ file });
  return uploaded.uri;
}

export class RunwayProvider implements VideoProvider {
  readonly name = "runway";

  async startImageToVideo(
    input: ImageToVideoInput
  ): Promise<{ externalTaskId: string }> {
    try {
      const client = getClient();
      const promptImage = await resolvePromptImage(client, input.imageUrl);

      const task = await client.imageToVideo.create({
        model: "gen4.5",
        promptImage,
        promptText: input.negativePrompt
          ? `${input.prompt}. Avoid: ${input.negativePrompt}`
          : input.prompt,
        duration: mapDurationForRunway(input.duration),
        ratio: mapAspectRatioForRunway(input.aspectRatio),
      });

      return { externalTaskId: task.id };
    } catch (error) {
      throw classifyProviderError(error);
    }
  }

  async getTask(externalTaskId: string): Promise<ProviderTaskResult> {
    try {
      const client = getClient();
      const task = await client.tasks.retrieve(externalTaskId);

      if (task.status === "PENDING") {
        return { status: "pending" };
      }
      if (task.status === "THROTTLED" || task.status === "RUNNING") {
        return { status: "running" };
      }
      if (task.status === "SUCCEEDED") {
        const videoUrl = Array.isArray(task.output) ? task.output[0] : undefined;
        if (!videoUrl || typeof videoUrl !== "string") {
          return {
            status: "failed",
            error: "Runway returned success without a video URL.",
            errorCode: "PROVIDER",
          };
        }
        return { status: "succeeded", videoUrl };
      }
      if (task.status === "CANCELLED") {
        return {
          status: "failed",
          error: "The Runway task was cancelled.",
          errorCode: "PROVIDER",
        };
      }

      const failure =
        "failure" in task && typeof task.failure === "string"
          ? task.failure
          : "Runway generation failed.";
      const classified = classifyProviderError(new Error(failure));
      return {
        status: "failed",
        error: classified.message,
        errorCode: classified.code,
      };
    } catch (error) {
      if (error instanceof TaskFailedError) {
        const classified = classifyProviderError(error);
        return {
          status: "failed",
          error: classified.message,
          errorCode: classified.code,
        };
      }
      throw classifyProviderError(error);
    }
  }
}
