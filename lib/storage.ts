import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export interface StoredFile {
  /** Public URL path or absolute URL usable by the client */
  publicUrl: string;
  /** Absolute URL preferred for external providers */
  absoluteUrl: string;
}

function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function isS3Enabled(): boolean {
  return Boolean(
    process.env.STORAGE_BUCKET_URL ||
      (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID)
  );
}

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  return "jpg";
}

export async function storeUpload(
  buffer: Buffer,
  mimeType: string,
  folder: "images" | "videos" = "images"
): Promise<StoredFile> {
  const ext = extensionForMime(mimeType);
  const key = `${folder}/${randomUUID()}.${ext}`;

  if (isS3Enabled()) {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error("S3_BUCKET is required when using S3 storage.");
    }

    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const base =
      process.env.STORAGE_BUCKET_URL?.replace(/\/$/, "") ||
      `https://${bucket}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;
    const absoluteUrl = `${base}/${key}`;
    return { publicUrl: absoluteUrl, absoluteUrl };
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadsDir, { recursive: true });
  const filename = path.basename(key);
  const filePath = path.join(uploadsDir, filename);
  await writeFile(filePath, buffer);

  const publicUrl = `/uploads/${folder}/${filename}`;
  const absoluteUrl = `${getAppBaseUrl()}${publicUrl}`;
  return { publicUrl, absoluteUrl };
}

export function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${getAppBaseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}
