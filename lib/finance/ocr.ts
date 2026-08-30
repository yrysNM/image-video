import os from "node:os";
import path from "node:path";

const CACHE_PATH = path.join(os.tmpdir(), "tesseract-cache");

/**
 * Runs OCR on an image buffer using tesseract.js in Node. tesseract.js is kept
 * as a server-external package (see next.config.mjs) so its worker/core assets
 * resolve from node_modules at runtime; language data is cached under tmp.
 */
export async function ocrImage(buffer: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { cachePath: CACHE_PATH });
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text;
  } finally {
    await worker.terminate();
  }
}
