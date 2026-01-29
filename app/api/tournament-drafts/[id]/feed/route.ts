// app/api/tournament-drafts/[id]/feed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { RawQueryResult, SuitCounts, ReactionType } from "@/types";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";

// Feed item type for response
interface FeedItem {
  id: number | string; // string for synthetic knockout IDs like "ko-123"
  tournament_draft_id: number;
  item_type: 'knockout' | 'message' | 'checkin' | 'system' | 'td_message';
  author_uid: string | null;
  author_name: string | null;
  author_photo_url: string | null;
  message_text: string | null;
  eliminated_player_name: string | null;
  hitman_name: string | null;
  ko_position: number | null;
  created_at: string;
  reactions?: {
    totals: SuitCounts;
    mine?: SuitCounts;
  };
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

    // Always fetch ALL TD messages and chat messages (they should always be visible)
    const alwaysVisibleMessages = await prisma.$queryRaw<RawQueryResult[]>`
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
        AND f.item_type IN ('td_message', 'message')
      ORDER BY f.created_at DESC
    `;

    // Fetch knockouts dynamically from tournament_draft_players (not from tournament_feed_items)
    // Order by knockedout_at ASC so first knockout has ko_position=1
    // Note: hitman_name already contains the hitman's nickname (if they have one) - stored at knockout time
    const knockoutPlayers = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        id as player_id,
        player_name,
        player_nickname,
        player_uid,
        hitman_name,
        knockedout_at
      FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentId}
        AND status = 'knockedout'
        AND knockedout_at IS NOT NULL
      ORDER BY knockedout_at ASC
    `;

    // Transform knockout players into FeedItem format with synthetic IDs
    const knockoutFeedItems: FeedItem[] = knockoutPlayers.map((player, index) => ({
      id: `ko-${player.player_id}`, // synthetic ID
      tournament_draft_id: tournamentId,
      item_type: 'knockout' as const,
      author_uid: player.player_uid ? String(player.player_uid) : null,
      author_name: null,
      author_photo_url: null,
      message_text: null,
      eliminated_player_name: player.player_nickname
        ? String(player.player_nickname)
        : String(player.player_name),
      hitman_name: player.hitman_name ? String(player.hitman_name) : null,
      ko_position: index + 1, // 1-based position from knockedout_at order
      created_at: player.knockedout_at instanceof Date
        ? player.knockedout_at.toISOString()
        : String(player.knockedout_at),
    }));

    // Fetch other feed items with pagination (check-ins, system - NOT knockouts)
    let otherItems: RawQueryResult[];
    const fetchLimit = limit + 1;

    if (before) {
      // Cursor-based pagination: get items older than the cursor (excluding always-visible types and knockouts)
      otherItems = await prisma.$queryRaw<RawQueryResult[]>`
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
          AND f.item_type NOT IN ('td_message', 'message', 'knockout')
          AND f.created_at < ${new Date(before)}
        ORDER BY f.created_at DESC
        LIMIT ${fetchLimit}
      `;
    } else {
      // Initial load: get most recent paginated items (check-ins, system - NOT knockouts)
      otherItems = await prisma.$queryRaw<RawQueryResult[]>`
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
          AND f.item_type NOT IN ('td_message', 'message', 'knockout')
        ORDER BY f.created_at DESC
        LIMIT ${fetchLimit}
      `;
    }

    // Check if there are more paginated items
    const hasMore = otherItems.length > limit;

    // Remove the extra item we fetched for pagination check
    if (hasMore) {
      otherItems = otherItems.slice(0, limit);
    }

    // Merge always-visible messages with other items and deduplicate by id
    const seenIds = new Set<number | string>();
    const feedItems: RawQueryResult[] = [];

    for (const item of [...alwaysVisibleMessages, ...otherItems]) {
      const id = Number(item.id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        feedItems.push(item);
      }
    }

    // Serialize DB items (handle BigInt and Date)
    const serializedDbItems: FeedItem[] = feedItems.map((item) => ({
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

    // Merge DB items with dynamically computed knockout items
    const serializedItems: FeedItem[] = [...serializedDbItems, ...knockoutFeedItems];

    // Sort all items by created_at DESC
    serializedItems.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    // Determine the next cursor (timestamp of the oldest paginated item in this batch)
    // We use otherItems for the cursor since TD messages and chat messages are always fully returned
    const oldestOtherItem = otherItems.length > 0 ? otherItems[otherItems.length - 1] : null;
    const nextCursor = hasMore && oldestOtherItem
      ? (oldestOtherItem.created_at instanceof Date
          ? oldestOtherItem.created_at.toISOString()
          : String(oldestOtherItem.created_at))
      : null;

    // Batch-load reactions for all feed items
    const allItemIds = serializedItems.map(item => String(item.id));
    if (allItemIds.length > 0) {
      // Get aggregated totals for all items
      const reactionTotals = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT feed_item_id, reaction_type, SUM(count) as total
        FROM feed_item_reactions
        WHERE feed_item_id IN (${Prisma.join(allItemIds)})
          AND tournament_draft_id = ${tournamentId}
        GROUP BY feed_item_id, reaction_type
      `;

      // Build a map of item_id -> SuitCounts
      const totalsMap = new Map<string, SuitCounts>();
      for (const row of reactionTotals) {
        const fid = String(row.feed_item_id);
        if (!totalsMap.has(fid)) {
          totalsMap.set(fid, { heart: 0, diamond: 0, club: 0, spade: 0 });
        }
        const rt = String(row.reaction_type) as ReactionType;
        const counts = totalsMap.get(fid)!;
        counts[rt] = Number(row.total);
      }

      // If user is authenticated, also get their per-item counts
      const session = await getServerSession(authOptions);
      const mineMap = new Map<string, SuitCounts>();
      if (session?.user?.uid) {
        const myReactions = await prisma.$queryRaw<RawQueryResult[]>`
          SELECT feed_item_id, reaction_type, count
          FROM feed_item_reactions
          WHERE feed_item_id IN (${Prisma.join(allItemIds)})
            AND tournament_draft_id = ${tournamentId}
            AND user_uid = ${session.user.uid}
        `;

        for (const row of myReactions) {
          const fid = String(row.feed_item_id);
          if (!mineMap.has(fid)) {
            mineMap.set(fid, { heart: 0, diamond: 0, club: 0, spade: 0 });
          }
          const rt = String(row.reaction_type) as ReactionType;
          const counts = mineMap.get(fid)!;
          counts[rt] = Number(row.count);
        }
      }

      // Attach reactions to each item
      for (const item of serializedItems) {
        const itemIdStr = String(item.id);
        const totals = totalsMap.get(itemIdStr);
        const mine = mineMap.get(itemIdStr);
        if (totals || mine) {
          item.reactions = {
            totals: totals || { heart: 0, diamond: 0, club: 0, spade: 0 },
            ...(mine ? { mine } : {}),
          };
        }
      }
    }

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