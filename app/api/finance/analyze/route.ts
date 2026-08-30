import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { analyzeText, type FinanceAnalysis } from "@/lib/finance/analyze";
import { ocrImage } from "@/lib/finance/ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TEXT_LENGTH = 200_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function extractPdfText(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  // Import the library entry point directly to avoid pdf-parse's debug harness,
  // which tries to read a bundled test file when imported as the package root.
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (mod.default ?? mod) as (data: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(bytes);
  return result.text ?? "";
}

export async function POST(
  request: Request
): Promise<NextResponse<{ analysis: FinanceAnalysis; text: string } | { error: string; code?: string }>> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let text = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as
        | { text?: unknown }
        | null;
      if (body && typeof body.text === "string") {
        text = body.text;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const textField = form.get("text");
      const file = form.get("file");

      if (typeof textField === "string" && textField.trim()) {
        text = textField;
      } else if (file instanceof File && file.size > 0) {
        if (file.size > MAX_FILE_BYTES) {
          return jsonError("File is too large (max 15MB).", 400, "VALIDATION");
        }
        const name = file.name.toLowerCase();
        const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
        const isImage =
          ALLOWED_IMAGE_TYPES.includes(file.type) ||
          /\.(png|jpe?g|webp)$/.test(name);

        if (isPdf) {
          text = await extractPdfText(file);
        } else if (isImage) {
          const bytes = Buffer.from(await file.arrayBuffer());
          text = await ocrImage(bytes);
        } else {
          return jsonError(
            "Upload a PNG/JPG screenshot or a PDF statement.",
            400,
            "VALIDATION"
          );
        }
      }
    }

    text = text.slice(0, MAX_TEXT_LENGTH).trim();
    if (!text) {
      return jsonError(
        "No readable text found. Upload a clearer screenshot or a text-based PDF.",
        400,
        "VALIDATION"
      );
    }

    const analysis = analyzeText(text);
    if (analysis.transactionCount === 0) {
      return jsonError(
        "Couldn't find any transactions in the document. Make sure amounts are visible.",
        422,
        "VALIDATION"
      );
    }

    return NextResponse.json({ analysis, text });
  } catch (error) {
    console.error("POST /api/finance/analyze", error);
    return jsonError("Failed to analyze the document.", 500, "INTERNAL");
  }
}
