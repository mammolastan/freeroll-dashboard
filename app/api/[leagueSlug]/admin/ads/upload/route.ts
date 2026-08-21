// app/api/[leagueSlug]/admin/ads/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "ads");

// Allowed file types
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

// Max file size before compression (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Target dimensions for ad images (portrait 4:5 ratio)
const TARGET_WIDTH = 640;
const TARGET_HEIGHT = 800;

// WebP quality for compression
const WEBP_QUALITY = 85;

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// POST - Upload an ad image
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueSlug } = await params;
    const leagueId = await getLeagueIdBySlug(leagueSlug);
    if (!leagueId) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const role = await getLeagueRole(session.user.uid, leagueId);
    if (!canAccessAdmin(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
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

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueId = uuidv4().slice(0, 8);
    const filename = `${leagueId}-${timestamp}-${uniqueId}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process and compress image with sharp
    // Auto-rotate based on EXIF, resize to fit within target dimensions, convert to WebP
    await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF Orientation tag
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toFile(filepath);

    // Return the URL for the uploaded image
    const imageUrl = `/api/uploads/ads/${filename}`;

    return NextResponse.json({ imageUrl }, { status: 201 });
  } catch (error) {
    console.error("Error uploading ad image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
