import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOrCreateSessionId } from "@/lib/session";
import { asGenerationStatus } from "@/lib/status";
import type { HistoryResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<
  NextResponse<HistoryResponse | { error: string; code?: string }>
> {
  try {
    const sessionId = await getOrCreateSessionId();

    const rows = await prisma.generation.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const body: HistoryResponse = {
      items: rows.map((row) => ({
        id: row.id,
        status: asGenerationStatus(row.status),
        prompt: row.prompt,
        imageUrl: row.imageUrl,
        videoUrl: row.videoUrl,
        createdAt: row.createdAt.toISOString(),
        duration: row.duration,
        aspectRatio: row.aspectRatio,
      })),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/history", error);
    return jsonError("Unexpected server error.", 500, "INTERNAL");
  }
}
