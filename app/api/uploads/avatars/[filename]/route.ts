// app/api/uploads/avatars/[filename]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filepath = path.join(UPLOAD_DIR, sanitizedFilename);

    // Check if file exists
    if (!existsSync(filepath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(filepath);

    // Determine content type
    const ext = sanitizedFilename.split(".").pop()?.toLowerCase() || "jpg";
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Return file with caching headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving avatar:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 }
    );
  }
}
