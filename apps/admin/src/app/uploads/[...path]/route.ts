/**
 * Serve runtime-uploaded media in production.
 *
 * Next.js only serves files that existed in `public/` at build time, so
 * files written to `public/uploads` at runtime are NOT served by the
 * production server. This route streams them from disk with path-traversal
 * protection and long-lived caching. In development, static `public/uploads`
 * takes precedence and this handler is only a fallback.
 *
 * For serverless / multi-instance deploys, swap the storage adapter for an
 * S3-compatible one instead (the StorageAdapter interface already supports it).
 */

import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.resolve(
  process.env.PRESSLYN_UPLOADS_DIR ?? path.join(process.cwd(), "public/uploads")
);

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const fullPath = path.resolve(UPLOADS_DIR, relative);

  // Path-traversal guard — the resolved path must stay inside UPLOADS_DIR.
  if (fullPath !== UPLOADS_DIR && !fullPath.startsWith(UPLOADS_DIR + path.sep)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let fileStat;
  try {
    fileStat = await stat(fullPath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!fileStat.isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const stream = Readable.toWeb(
    createReadStream(fullPath)
  ) as unknown as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
