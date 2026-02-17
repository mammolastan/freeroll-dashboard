// app/api/tournament-drafts/[id]/feed/photo/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "feed-photos");

// Allowed file types (including HEIC/HEIF for iPhone photos)
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

// Target max dimension for resized images
const MAX_DIMENSION = 800;

// WebP quality for compression (0-100)
const WEBP_QUALITY = 60;

// POST - Upload a photo to the tournament feed (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Verify tournament exists and is in progress
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, status FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    if (tournament[0].status !== "in_progress") {
      return NextResponse.json(
        { error: "Cannot upload photos to a tournament that is not in progress" },
        { status: 400 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const caption = formData.get("caption") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No photo provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP" },
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

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueId = uuidv4().slice(0, 8);
    const filename = `${tournamentId}-${timestamp}-${uniqueId}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process and compress image with sharp
    // Resize to max dimension while maintaining aspect ratio, convert to WebP
    await sharp(buffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toFile(filepath);

    // Trim and validate caption
    const trimmedCaption = caption?.trim() || null;
    const finalCaption = trimmedCaption && trimmedCaption.length > 500
      ? trimmedCaption.slice(0, 500)
      : trimmedCaption;

    // Insert feed item record
    await prisma.$executeRaw`
      INSERT INTO tournament_feed_items
      (tournament_draft_id, item_type, message_text, photo_filename, created_at)
      VALUES (${tournamentId}, 'photo', ${finalCaption}, ${filename}, NOW())
    `;

    // Get the inserted record
    const newItem = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        id,
        tournament_draft_id,
        item_type,
        author_uid,
        author_name,
        message_text,
        photo_filename,
        created_at
      FROM tournament_feed_items
      WHERE id = LAST_INSERT_ID()
    `;

    if (!newItem.length) {
      return NextResponse.json(
        { error: "Failed to create feed item" },
        { status: 500 }
      );
    }

    // Serialize the response
    const item = newItem[0];
    const serializedItem = {
      id: Number(item.id),
      tournament_draft_id: Number(item.tournament_draft_id),
      item_type: "photo" as const,
      author_uid: null,
      author_name: null,
      author_photo_url: null,
      message_text: item.message_text ? String(item.message_text) : null,
      eliminated_player_name: null,
      eliminated_player_uid: null,
      eliminated_player_photo_url: null,
      hitman_name: null,
      hitman_uid: null,
      hitman_photo_url: null,
      ko_position: null,
      photo_url: `/api/uploads/feed-photos/${filename}`,
      created_at: item.created_at instanceof Date
        ? item.created_at.toISOString()
        : String(item.created_at),
    };

    // Broadcast the new feed item to all connected clients
    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastFeedItem(tournamentId, serializedItem);
    } catch (broadcastError) {
      console.error("Failed to broadcast photo feed item:", broadcastError);
    }

    return NextResponse.json({ item: serializedItem });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    );
  }
}
