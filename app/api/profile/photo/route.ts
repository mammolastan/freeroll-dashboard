import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// POST - Upload photo
export async function POST(request: NextRequest) {
  try {
    console.log("[Photo Upload] Starting upload process");
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      console.log("[Photo Upload] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Photo Upload] User: ${session.user.uid}`);
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      console.log("[Photo Upload] No file in form data");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`[Photo Upload] File received: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.log(`[Photo Upload] Invalid file type: ${file.type}`);
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: JPG, PNG, GIF, WebP` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.log(`[Photo Upload] File too large: ${file.size} bytes`);
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB` },
        { status: 400 }
      );
    }

    console.log("[Photo Upload] Validation passed, ensuring upload directory");
    await ensureUploadDir();

    // Get file extension
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const filename = `${session.user.uid}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    console.log(`[Photo Upload] Target filename: ${filename}`);

    // Delete old photo if it exists (might have different extension)
    console.log("[Photo Upload] Checking for existing photo");
    const player = await prisma.player.findUnique({
      where: { uid: session.user.uid },
      select: { photo_url: true },
    });

    if (player?.photo_url) {
      const oldFilename = player.photo_url.split("/").pop()?.split("?")[0]; // Remove query params
      if (oldFilename && oldFilename !== filename) {
        const oldFilepath = path.join(UPLOAD_DIR, oldFilename);
        console.log(`[Photo Upload] Deleting old photo: ${oldFilename}`);
        try {
          await unlink(oldFilepath);
        } catch (err) {
          console.log(`[Photo Upload] Could not delete old file: ${err}`);
        }
      }
    }

    // Write new file
    console.log("[Photo Upload] Converting file to buffer");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`[Photo Upload] Buffer size: ${buffer.length} bytes, writing to ${filepath}`);
    await writeFile(filepath, buffer);
    console.log("[Photo Upload] File written successfully");

    // Update database with cache-busting timestamp
    const timestamp = Date.now();
    const photoUrl = `/uploads/avatars/${filename}?t=${timestamp}`;
    console.log(`[Photo Upload] Updating database with URL: ${photoUrl}`);
    await prisma.player.update({
      where: { uid: session.user.uid },
      data: { photo_url: photoUrl },
    });

    console.log("[Photo Upload] Upload complete");
    return NextResponse.json({ photo_url: photoUrl });
  } catch (error) {
    console.error("Photo upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload photo";
    return NextResponse.json(
      { error: `Upload failed: ${errorMessage}` },
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

    const player = await prisma.player.findUnique({
      where: { uid: session.user.uid },
      select: { photo_url: true },
    });

    if (player?.photo_url) {
      // Delete file
      const filename = player.photo_url.split("/").pop();
      if (filename) {
        const filepath = path.join(UPLOAD_DIR, filename);
        try {
          await unlink(filepath);
        } catch {
          // File might not exist, continue anyway
        }
      }

      // Update database
      await prisma.player.update({
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
