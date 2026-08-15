import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getVideoProvider } from "@/lib/providers";
import { getOrCreateSessionId } from "@/lib/session";
import { asGenerationStatus } from "@/lib/status";
import type { StatusResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { jobId: string };
};

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<NextResponse<StatusResponse | { error: string; code?: string }>> {
  try {
    const sessionId = await getOrCreateSessionId();
    const { jobId } = context.params;

    const generation = await prisma.generation.findUnique({
      where: { id: jobId },
    });

    if (!generation || generation.sessionId !== sessionId) {
      return jsonError("Generation not found.", 404, "NOT_FOUND");
    }

    if (
      generation.status === "PENDING" ||
      generation.status === "PROCESSING"
    ) {
      if (generation.externalTaskId) {
        const provider = getVideoProvider();
        try {
          const task = await provider.getTask(generation.externalTaskId);

          if (task.status === "succeeded" && task.videoUrl) {
            await prisma.generation.update({
              where: { id: generation.id },
              data: {
                status: "SUCCEEDED",
                videoUrl: task.videoUrl,
                errorMessage: null,
              },
            });
          } else if (task.status === "failed") {
            await prisma.generation.update({
              where: { id: generation.id },
              data: {
                status: "FAILED",
                errorMessage:
                  task.error || "Video generation failed.",
              },
            });
          } else if (generation.status === "PENDING") {
            await prisma.generation.update({
              where: { id: generation.id },
              data: { status: "PROCESSING" },
            });
          }
        } catch (error) {
          console.error("Provider poll error", error);
        }
      }
    }

    const fresh = await prisma.generation.findUniqueOrThrow({
      where: { id: jobId },
    });

    const body: StatusResponse = {
      jobId: fresh.id,
      status: asGenerationStatus(fresh.status),
      prompt: fresh.prompt,
      negativePrompt: fresh.negativePrompt,
      duration: fresh.duration,
      aspectRatio: fresh.aspectRatio,
      imageUrl: fresh.imageUrl,
      videoUrl: fresh.videoUrl,
      errorMessage: fresh.errorMessage,
      createdAt: fresh.createdAt.toISOString(),
      updatedAt: fresh.updatedAt.toISOString(),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/status", error);
    return jsonError("Unexpected server error.", 500, "INTERNAL");
  }
}
