// app/api/tournament-drafts/[id]/feed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";

// Feed item type for response
interface FeedItem {
  id: number;
  tournament_draft_id: number;
  item_type: 'knockout' | 'message' | 'checkin' | 'system';
  author_uid: string | null;
  author_name: string | null;
  author_photo_url: string | null;
  message_text: string | null;
  eliminated_player_name: string | null;
  hitman_name: string | null;
  ko_position: number | null;
  created_at: string;
}

interface FeedResponse {
  items: FeedItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

// GET - Fetch feed items for a tournament with cursor-based pagination
export async function GET(
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100); // Max 100 items
    const before = searchParams.get("before"); // ISO timestamp for cursor-based pagination

    // Verify tournament exists
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Fetch feed items with optional cursor
    let feedItems: RawQueryResult[];

    const fetchLimit = limit + 1;

    if (before) {
      // Cursor-based pagination: get items older than the cursor
      feedItems = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          f.id,
          f.tournament_draft_id,
          f.item_type,
          f.author_uid,
          f.author_name,
          p.photo_url as author_photo_url,
          f.message_text,
          f.eliminated_player_name,
          f.hitman_name,
          f.ko_position,
          f.created_at
        FROM tournament_feed_items f
        LEFT JOIN players p ON f.author_uid COLLATE utf8mb4_unicode_ci = p.uid COLLATE utf8mb4_unicode_ci
        WHERE f.tournament_draft_id = ${tournamentId}
          AND f.created_at < ${new Date(before)}
        ORDER BY f.created_at DESC
        LIMIT ${fetchLimit}
      `;
    } else {
      // Initial load: get most recent items
      feedItems = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          f.id,
          f.tournament_draft_id,
          f.item_type,
          f.author_uid,
          f.author_name,
          p.photo_url as author_photo_url,
          f.message_text,
          f.eliminated_player_name,
          f.hitman_name,
          f.ko_position,
          f.created_at
        FROM tournament_feed_items f
        LEFT JOIN players p ON f.author_uid COLLATE utf8mb4_unicode_ci = p.uid COLLATE utf8mb4_unicode_ci
        WHERE f.tournament_draft_id = ${tournamentId}
        ORDER BY f.created_at DESC
        LIMIT ${fetchLimit}
      `;
    }

    // Check if there are more items
    const hasMore = feedItems.length > limit;
    
    // Remove the extra item we fetched for pagination check
    if (hasMore) {
      feedItems = feedItems.slice(0, limit);
    }

    // Serialize the response (handle BigInt and Date)
    // Cast string fields explicitly since Prisma raw queries return {} for nullable fields
    const serializedItems: FeedItem[] = feedItems.map((item) => ({
      id: Number(item.id),
      tournament_draft_id: Number(item.tournament_draft_id),
      item_type: item.item_type as FeedItem['item_type'],
      author_uid: item.author_uid ? String(item.author_uid) : null,
      author_name: item.author_name ? String(item.author_name) : null,
      author_photo_url: item.author_photo_url ? String(item.author_photo_url) : null,
      message_text: item.message_text ? String(item.message_text) : null,
      eliminated_player_name: item.eliminated_player_name ? String(item.eliminated_player_name) : null,
      hitman_name: item.hitman_name ? String(item.hitman_name) : null,
      ko_position: item.ko_position ? Number(item.ko_position) : null,
      created_at: item.created_at instanceof Date
        ? item.created_at.toISOString()
        : String(item.created_at),
    }));

    // Determine the next cursor (timestamp of the oldest item in this batch)
    const nextCursor = hasMore && serializedItems.length > 0
      ? serializedItems[serializedItems.length - 1].created_at
      : null;

    const response: FeedResponse = {
      items: serializedItems,
      hasMore,
      nextCursor,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching tournament feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournament feed" },
      { status: 500 }
    );
  }
}

// POST - Post a message to the tournament feed (requires authentication)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required. Please log in to post messages." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { message } = body;

    // Validate message
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedMessage.length > 500) {
      return NextResponse.json(
        { error: "Message cannot exceed 500 characters" },
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
        { error: "Cannot post to a tournament that is not in progress" },
        { status: 400 }
      );
    }

    // Get author name (prefer nickname, fall back to name)
    const authorName = session.user.nickname || session.user.name || "Anonymous";
    const authorUid = session.user.uid || null;

    // Insert the feed item
    await prisma.$executeRaw`
      INSERT INTO tournament_feed_items 
      (tournament_draft_id, item_type, author_uid, author_name, message_text, created_at)
      VALUES (${tournamentId}, 'message', ${authorUid}, ${authorName}, ${trimmedMessage}, NOW())
    `;

    // Get the inserted record with author photo
    const newItem = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        f.id,
        f.tournament_draft_id,
        f.item_type,
        f.author_uid,
        f.author_name,
        p.photo_url as author_photo_url,
        f.message_text,
        f.eliminated_player_name,
        f.hitman_name,
        f.ko_position,
        f.created_at
      FROM tournament_feed_items f
      LEFT JOIN players p ON f.author_uid COLLATE utf8mb4_unicode_ci = p.uid COLLATE utf8mb4_unicode_ci
      WHERE f.id = LAST_INSERT_ID()
    `;

    if (!newItem.length) {
      return NextResponse.json(
        { error: "Failed to create feed item" },
        { status: 500 }
      );
    }

    // Serialize the response
    const item = newItem[0];
    const serializedItem: FeedItem = {
      id: Number(item.id),
      tournament_draft_id: Number(item.tournament_draft_id),
      item_type: item.item_type as FeedItem["item_type"],
      author_uid: item.author_uid ? String(item.author_uid) : null,
      author_name: item.author_name ? String(item.author_name) : null,
      author_photo_url: item.author_photo_url ? String(item.author_photo_url) : null,
      message_text: item.message_text ? String(item.message_text) : null,
      eliminated_player_name: item.eliminated_player_name ? String(item.eliminated_player_name) : null,
      hitman_name: item.hitman_name ? String(item.hitman_name) : null,
      ko_position: item.ko_position ? Number(item.ko_position) : null,
      created_at: item.created_at instanceof Date
        ? item.created_at.toISOString()
        : String(item.created_at),
    };

    // Broadcast the new feed item to all connected clients
    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastFeedItem(tournamentId, serializedItem);
    } catch (broadcastError) {
      // Don't fail the request if broadcast fails
      console.error("Failed to broadcast feed item:", broadcastError);
    }

    return NextResponse.json({ item: serializedItem });
  } catch (error) {
    console.error("Error posting to tournament feed:", error);
    return NextResponse.json(
      { error: "Failed to post message" },
      { status: 500 }
    );
  }
}