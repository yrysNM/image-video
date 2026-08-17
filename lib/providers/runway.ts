import { readFile } from "fs/promises";
import path from "path";
import RunwayML, { TaskFailedError, toFile } from "@runwayml/sdk";
import {
  classifyProviderError,
  mapAspectRatioForRunway,
  mapAspectRatioForSeedance2,
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

  if (bytes.byteLength <= 4.5 * 1024 * 1024) {
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }

  return uploadEphemeral(client, bytes, filename, mime);
}

async function uploadEphemeral(
  client: RunwayML,
  bytes: Buffer,
  filename: string,
  mime: string
): Promise<string> {
  const file = await toFile(bytes, filename, { type: mime });
  const uploaded = await client.uploads.createEphemeral({ file });
  return uploaded.uri;
}

async function resolveCollaborativeImage(
  client: RunwayML,
  imageUrl: string
): Promise<string> {
  if (imageUrl.startsWith("runway://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(imageUrl);
    if (!match) {
      return imageUrl;
    }
    const mime = match[1];
    const bytes = Buffer.from(match[2], "base64");
    const ext = mime.includes("png") ? "png" : "jpg";
    return uploadEphemeral(client, bytes, `ref.${ext}`, mime);
  }

  if (isLocalOrRelativeUrl(imageUrl)) {
    const filePath = localPathFromUrl(imageUrl);
    const bytes = await readFile(filePath);
    const mime = mimeFromPath(filePath);
    const filename = path.basename(filePath);
    return uploadEphemeral(client, bytes, filename, mime);
  }

  return imageUrl;
}

async function resolvePromptImages(
  client: RunwayML,
  imageUrls: string[]
): Promise<string[]> {
  return Promise.all(
    imageUrls.map((url) => resolveCollaborativeImage(client, url))
  );
}

function formatRunwayFailure(failure: string, failureCode?: string): string {
  const code = failureCode ? ` [${failureCode}]` : "";
  const lower = `${failure} ${failureCode ?? ""}`.toLowerCase();
  const isSafety =
    /\bsafety\b/.test(lower) ||
    lower.includes("content policy") ||
    lower.includes("moderation") ||
    lower.includes("blocked by seedance") ||
    lower.includes("sensitive");

  if (isSafety) {
    return `Seedance 2 blocked this job${code}. That filter is run by ByteDance on Runway and often rejects photos of real people or recognizable faces — even in a fashion/textile ad. Try product-only shots (fabric, interiors, no faces), then retry. Runway said: ${failure}`;
  }

  return `Runway failed${code}: ${failure}`;
}

function buildPromptText(input: ImageToVideoInput): string {
  const base = input.prompt.trim();
  if (input.collaborative && input.imageUrls && input.imageUrls.length > 1) {
    return `${base}. Blend and transition smoothly between all reference images in one cohesive cinematic sequence.`;
  }
  if (input.negativePrompt) {
    return `${base}. Avoid: ${input.negativePrompt}`;
  }
  return base;
}

export class RunwayProvider implements VideoProvider {
  readonly name = "runway";

  async startImageToVideo(
    input: ImageToVideoInput
  ): Promise<{ externalTaskId: string }> {
    try {
      const client = getClient();
      const promptText = buildPromptText(input);

      if (input.collaborative && input.imageUrls && input.imageUrls.length >= 3) {
        const uris = await resolvePromptImages(client, input.imageUrls);
        const task = await client.imageToVideo.create({
          model: "seedance2",
          promptImage: uris.map((uri) => ({ uri })),
          promptText,
          duration: input.duration,
          ratio: mapAspectRatioForSeedance2(input.aspectRatio),
          audio: false,
        });
        return { externalTaskId: task.id };
      }

      const promptImage = await resolvePromptImage(client, input.imageUrl);
      const task = await client.imageToVideo.create({
        model: "gen4.5",
        promptImage,
        promptText,
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
      const failureCode =
        "failureCode" in task && typeof task.failureCode === "string"
          ? task.failureCode
          : undefined;
      console.error("Runway task failed", {
        id: externalTaskId,
        failure,
        failureCode,
      });
      const classified = classifyProviderError(
        new Error(formatRunwayFailure(failure, failureCode))
      );
      return {
        status: "failed",
        error: classified.message,
        errorCode: classified.code,
      };
    } catch (error) {
      if (error instanceof TaskFailedError) {
        const details = error.taskDetails;
        const failure =
          "failure" in details && typeof details.failure === "string"
            ? details.failure
            : error.message;
        const failureCode =
          "failureCode" in details && typeof details.failureCode === "string"
            ? details.failureCode
            : undefined;
        const classified = classifyProviderError(
          new Error(formatRunwayFailure(failure, failureCode))
        );
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
