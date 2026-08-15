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
  isDurationOption,
  validateImageFile,
  validatePrompt,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const image = form.get("image");
    const reuseImageUrl = form.get("imageUrl");

    const prompt = typeof promptRaw === "string" ? promptRaw : "";
    const promptError = validatePrompt(prompt);
    if (promptError) {
      return jsonError(promptError, 400, "VALIDATION");
    }

    const durationNum =
      typeof durationRaw === "string" ? Number(durationRaw) : NaN;
    if (!isDurationOption(durationNum)) {
      return jsonError("Duration must be 4, 6, or 10 seconds.", 400, "VALIDATION");
    }

    if (typeof aspectRaw !== "string" || !isAspectRatioOption(aspectRaw)) {
      return jsonError(
        "Aspect ratio must be 16:9, 9:16, or 1:1.",
        400,
        "VALIDATION"
      );
    }

    let imagePublicUrl: string;
    let imageAbsoluteUrl: string;

    if (image instanceof File && image.size > 0) {
      const imageError = validateImageFile(image);
      if (imageError) {
        return jsonError(imageError, 400, "VALIDATION");
      }
      const bytes = Buffer.from(await image.arrayBuffer());
      const stored = await storeUpload(bytes, image.type, "images");
      imagePublicUrl = stored.publicUrl;
      imageAbsoluteUrl = stored.absoluteUrl;
    } else if (typeof reuseImageUrl === "string" && reuseImageUrl.trim()) {
      imagePublicUrl = reuseImageUrl.trim();
      imageAbsoluteUrl = toAbsoluteUrl(imagePublicUrl);
    } else {
      return jsonError("An image file is required.", 400, "VALIDATION");
    }

    const negativePrompt =
      typeof negativeRaw === "string" && negativeRaw.trim()
        ? negativeRaw.trim()
        : null;

    const provider = getVideoProvider();

    const generation = await prisma.generation.create({
      data: {
        sessionId,
        status: "PENDING",
        prompt: prompt.trim(),
        negativePrompt,
        duration: durationNum,
        aspectRatio: aspectRaw,
        imageUrl: imagePublicUrl,
        provider: provider.name,
      },
    });

    try {
      const { externalTaskId } = await provider.startImageToVideo({
        imageUrl: imageAbsoluteUrl,
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
    } catch (error) {
      const message =
        error instanceof ProviderError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to start video generation.";
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

    return NextResponse.json({ jobId: generation.id });
  } catch (error) {
    console.error("POST /api/generate", error);
    return jsonError("Unexpected server error.", 500, "INTERNAL");
  }
}
