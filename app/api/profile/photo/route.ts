// app/api/profile/photo/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink, mkdir, writeFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import sharp from "sharp";
import { logError } from "@/lib/error-logger";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

// Sharp processing settings
const MAX_DIMENSION = 800;
const WEBP_QUALITY = 80;
const MAX_GIF_OUTPUT_SIZE = 150 * 1024; // 150KB max for animated GIFs

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// POST - Upload photo
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const user_agent = request.headers.get("user-agent") ?? null;

  let player_uid: string | null = null;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    player_uid = session.user.uid;
    const baseLogCtx = { player_uid, ip_address: ip, user_agent };

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP, HEIC" },
        { status: 400 }
      );
    }

    // Validate file size
    // Log file metadata for debugging
    console.log(`[photo-upload] Received file: name=${file.name}, type=${file.type}, size=${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    if (file.size > MAX_FILE_SIZE) {
      await logError({
        error_code: "PHOTO_UPLOAD_FILE_TOO_LARGE_SERVER",
        feature: "photo_upload",
        severity: "warn",
        message: `Server rejected file: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds ${MAX_FILE_SIZE} byte limit`,
        context: { ...baseLogCtx, file_name: file.name, file_size: file.size, file_type: file.type, limit_bytes: MAX_FILE_SIZE },
        player_uid,
      });
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    await ensureUploadDir();

    // Always save as WebP for consistency and transparency support
    const filename = `${session.user.uid}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Delete old photo if it exists (might have different extension from before)
    const player = await prisma.players_v2.findUnique({
      where: { uid: session.user.uid },
      select: { photo_url: true },
    });

    if (player?.photo_url) {
      const oldFilename = player.photo_url.split("/").pop()?.split("?")[0];
      if (oldFilename && oldFilename !== filename) {
        const oldFilepath = path.join(UPLOAD_DIR, oldFilename);
        try {
          await unlink(oldFilepath);
        } catch {
          // File might not exist, ignore
        }
      }
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const isGif = file.type === "image/gif";

    // Process and compress image with Sharp
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(buffer, { animated: true })
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch (err) {
      await logError({
        error_code: "PHOTO_UPLOAD_SHARP_ERROR",
        feature: "photo_upload",
        severity: "error",
        message: err instanceof Error ? err.message : "Image processing failed",
        error: err,
        context: { ...baseLogCtx, file_name: file.name, file_size: file.size, file_type: file.type },
        player_uid,
      });
      return NextResponse.json({ error: "Image processing failed" }, { status: 500 });
    }

    // Check file size limit for animated GIFs
    if (isGif && processedBuffer.length > MAX_GIF_OUTPUT_SIZE) {
      const sizeKB = Math.round(processedBuffer.length / 1024);
      return NextResponse.json(
        { error: `Animated GIF too large after processing (${sizeKB}KB). Maximum is 150KB. Try a smaller or shorter GIF.` },
        { status: 400 }
      );
    }

    // Write processed image to file
    try {
      await writeFile(filepath, processedBuffer);
    } catch (err) {
      await logError({
        error_code: "PHOTO_UPLOAD_FILE_WRITE_ERROR",
        feature: "photo_upload",
        severity: "fatal",
        message: err instanceof Error ? err.message : "Disk write failed",
        error: err,
        context: { ...baseLogCtx, filepath },
        player_uid,
      });
      return NextResponse.json({ error: "Could not save photo" }, { status: 500 });
    }

    // Update database with cache-busting timestamp
    const timestamp = Date.now();
    const photoUrl = `/api/uploads/avatars/${filename}?t=${timestamp}`;
    try {
      await prisma.players_v2.update({
        where: { uid: session.user.uid },
        data: { photo_url: photoUrl },
      });
    } catch (err) {
      await logError({
        error_code: "PHOTO_UPLOAD_SAVE_FAILED",
        feature: "photo_upload",
        severity: "error",
        message: err instanceof Error ? err.message : "DB update failed",
        error: err,
        context: { ...baseLogCtx },
        player_uid,
      });
      return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
    }

    return NextResponse.json({ photo_url: photoUrl });
  } catch (error) {
    await logError({
      error_code: "PHOTO_UPLOAD_SERVER_ERROR",
      feature: "photo_upload",
      severity: "fatal",
      message: error instanceof Error ? error.message : "Unhandled upload error",
      error: error,
      context: { ip_address: ip, user_agent },
      player_uid,
    });
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    );
  }
}

// DELETE - Remove photo
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const player = await prisma.players_v2.findUnique({
      where: { uid: session.user.uid },
      select: { photo_url: true },
    });

    if (player?.photo_url) {
      // Delete file (strip query string from filename)
      const filename = player.photo_url.split("/").pop()?.split("?")[0];
      if (filename) {
        const filepath = path.join(UPLOAD_DIR, filename);
        try {
          await unlink(filepath);
        } catch {
          // File might not exist, continue anyway
        }
      }

      // Update database
      await prisma.players_v2.update({
        where: { uid: session.user.uid },
        data: { photo_url: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Photo delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete photo" },
      { status: 500 }
    );
  }
}
