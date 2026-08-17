import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getVideoProvider } from "@/lib/providers";
import { ProviderError } from "@/lib/providers/types";
import { getOrCreateSessionId } from "@/lib/session";
import { storeUpload, toAbsoluteUrl } from "@/lib/storage";
import type { GenerateResponse } from "@/lib/types";
import {
  isAspectRatioOption,
  isCollaborativeRequest,
  isDurationOption,
  MAX_IMAGES,
  validateGenerationRequest,
  validateImageFile,
  validatePrompt,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PreparedImage {
  publicUrl: string;
  absoluteUrl: string;
}

function collectFiles(form: FormData): File[] {
  const named = form.getAll("images").concat(form.getAll("image"));
  return named.filter((value): value is File => value instanceof File && value.size > 0);
}

function collectReuseUrls(form: FormData): string[] {
  return form
    .getAll("imageUrl")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function POST(
  request: Request
): Promise<NextResponse<GenerateResponse | { error: string; code?: string }>> {
  try {
    const sessionId = await getOrCreateSessionId();
    const form = await request.formData();

    const promptRaw = form.get("prompt");
    const negativeRaw = form.get("negativePrompt");
    const durationRaw = form.get("duration");
    const aspectRaw = form.get("aspectRatio");

    const prompt = typeof promptRaw === "string" ? promptRaw : "";
    const promptError = validatePrompt(prompt);
    if (promptError) {
      return jsonError(promptError, 400, "VALIDATION");
    }

    const durationNum =
      typeof durationRaw === "string" ? Number(durationRaw) : NaN;
    if (!isDurationOption(durationNum)) {
      return jsonError(
        "Duration must be 4, 6, 10, 15, 20, or 30 seconds.",
        400,
        "VALIDATION"
      );
    }

    if (typeof aspectRaw !== "string" || !isAspectRatioOption(aspectRaw)) {
      return jsonError(
        "Aspect ratio must be 16:9, 9:16, or 1:1.",
        400,
        "VALIDATION"
      );
    }

    const files = collectFiles(form);
    const reuseUrls = collectReuseUrls(form);

    const requestError = validateGenerationRequest(
      files.length + reuseUrls.length,
      durationNum
    );
    if (requestError) {
      return jsonError(requestError, 400, "VALIDATION");
    }

    if (files.length + reuseUrls.length > MAX_IMAGES) {
      return jsonError(
        `You can upload at most ${MAX_IMAGES} images at once.`,
        400,
        "VALIDATION"
      );
    }

    const prepared: PreparedImage[] = [];

    for (const file of files) {
      const imageError = validateImageFile(file);
      if (imageError) {
        return jsonError(`${file.name}: ${imageError}`, 400, "VALIDATION");
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const stored = await storeUpload(bytes, file.type, "images");
      prepared.push({
        publicUrl: stored.publicUrl,
        absoluteUrl: stored.absoluteUrl,
      });
    }

    for (const url of reuseUrls) {
      prepared.push({
        publicUrl: url,
        absoluteUrl: toAbsoluteUrl(url),
      });
    }

    const negativePrompt =
      typeof negativeRaw === "string" && negativeRaw.trim()
        ? negativeRaw.trim()
        : null;

    const provider = getVideoProvider();
    const collaborative = isCollaborativeRequest(prepared.length, durationNum);

    if (collaborative && provider.name !== "runway") {
      return jsonError(
        "Collaborative 15–30s videos with three images require VIDEO_API_PROVIDER=runway.",
        400,
        "VALIDATION"
      );
    }

    if (collaborative) {
      const publicUrls = prepared.map((image) => image.publicUrl);
      const absoluteUrls = prepared.map((image) => image.absoluteUrl);

      const generation = await prisma.generation.create({
        data: {
          sessionId,
          status: "PENDING",
          prompt: prompt.trim(),
          negativePrompt,
          duration: durationNum,
          aspectRatio: aspectRaw,
          imageUrl: publicUrls[0],
          imageUrls: JSON.stringify(publicUrls),
          provider: provider.name,
        },
      });

      try {
        const { externalTaskId } = await provider.startImageToVideo({
          imageUrl: absoluteUrls[0],
          imageUrls: absoluteUrls,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt ?? undefined,
          duration: durationNum,
          aspectRatio: aspectRaw,
          collaborative: true,
        });

        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            externalTaskId,
            status: "PROCESSING",
          },
        });

        return NextResponse.json({
          jobId: generation.id,
          jobIds: [generation.id],
        });
      } catch (error) {
        const message =
          error instanceof ProviderError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to start collaborative video generation.";
        const code =
          error instanceof ProviderError ? error.code : "PROVIDER";

        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "FAILED",
            errorMessage: message,
          },
        });

        return jsonError(message, 502, code);
      }
    }

    const jobIds: string[] = [];
    const startErrors: string[] = [];

    for (const image of prepared) {
      const generation = await prisma.generation.create({
        data: {
          sessionId,
          status: "PENDING",
          prompt: prompt.trim(),
          negativePrompt,
          duration: durationNum,
          aspectRatio: aspectRaw,
          imageUrl: image.publicUrl,
          provider: provider.name,
        },
      });

      try {
        const { externalTaskId } = await provider.startImageToVideo({
          imageUrl: image.absoluteUrl,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt ?? undefined,
          duration: durationNum,
          aspectRatio: aspectRaw,
        });

        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            externalTaskId,
            status: "PROCESSING",
          },
        });
        jobIds.push(generation.id);
      } catch (error) {
        const message =
          error instanceof ProviderError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to start video generation.";

        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "FAILED",
            errorMessage: message,
          },
        });
        startErrors.push(message);
      }
    }

    if (jobIds.length === 0) {
      return jsonError(
        startErrors[0] || "Failed to start video generation.",
        502,
        "PROVIDER"
      );
    }

    return NextResponse.json({
      jobId: jobIds[0],
      jobIds,
    });
  } catch (error) {
    console.error("POST /api/generate", error);
    return jsonError("Unexpected server error.", 500, "INTERNAL");
  }
}