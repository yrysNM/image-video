import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { analyzeText, type FinanceAnalysis } from "@/lib/finance/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 200_000;
const MAX_PDF_BYTES = 15 * 1024 * 1024;

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
        if (file.size > MAX_PDF_BYTES) {
          return jsonError("File is too large (max 15MB).", 400, "VALIDATION");
        }
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
          return jsonError(
            "Only PDF files are parsed on the server. Images are read in your browser.",
            400,
            "VALIDATION"
          );
        }
        text = await extractPdfText(file);
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
