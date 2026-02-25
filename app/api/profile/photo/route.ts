// app/api/profile/photo/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink, mkdir, writeFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import sharp from "sharp";

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
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    if (file.size > MAX_FILE_SIZE) {
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
    // Resize to max dimension while maintaining aspect ratio, convert to WebP
    // animated: true preserves GIF animations as animated WebP
    const processedBuffer = await sharp(buffer, { animated: true })
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // Check file size limit for animated GIFs
    if (isGif && processedBuffer.length > MAX_GIF_OUTPUT_SIZE) {
      const sizeKB = Math.round(processedBuffer.length / 1024);
      return NextResponse.json(
        { error: `Animated GIF too large after processing (${sizeKB}KB). Maximum is 150KB. Try a smaller or shorter GIF.` },
        { status: 400 }
      );
    }

    // Write processed image to file
    await writeFile(filepath, processedBuffer);

    // Update database with cache-busting timestamp
    const timestamp = Date.now();
    const photoUrl = `/api/uploads/avatars/${filename}?t=${timestamp}`;
    await prisma.players_v2.update({
      where: { uid: session.user.uid },
      data: { photo_url: photoUrl },
    });

    return NextResponse.json({ photo_url: photoUrl });
  } catch (error) {
    console.error("Photo upload error:", error);
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
