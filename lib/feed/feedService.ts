// ===========================================
// lib/feed/feedService.ts
// ===========================================
// Helper functions for creating tournament feed items

import { prisma } from "@/lib/prisma";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";
import { RawQueryResult } from "@/types";

export interface FeedItemData {
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
}

/**
 * Broadcast a knockout event to connected clients (no database write)
 * Knockouts are now computed dynamically from tournament_draft_players
 */
export function broadcastKnockoutEvent(
  tournamentId: number,
  playerId: number,
  eliminatedPlayerName: string,
  hitmanName: string | null,
  koPosition: number,
  knockedoutAt: string
): void {
  const feedItem: FeedItemData = {
    id: `ko-${playerId}`, // synthetic ID
    tournament_draft_id: tournamentId,
    item_type: 'knockout',
    author_uid: null,
    author_name: null,
    author_photo_url: null,
    message_text: null,
    eliminated_player_name: eliminatedPlayerName,
    hitman_name: hitmanName,
    ko_position: koPosition,
    created_at: knockedoutAt,
  };

  try {
    const broadcast = BroadcastManager.getInstance();
    broadcast.broadcastFeedItem(tournamentId, feedItem);
    console.log(`[FEED] Broadcast knockout event: ${eliminatedPlayerName} eliminated by ${hitmanName || 'unknown'} at position ${koPosition}`);
  } catch (broadcastError) {
    console.error("Failed to broadcast knockout event:", broadcastError);
  }
}

/**
 * @deprecated Use broadcastKnockoutEvent instead. Knockouts are now computed dynamically.
 * This function is kept for backwards compatibility but no longer writes to DB.
 */
export async function createKnockoutFeedItem(
  tournamentId: number,
  eliminatedPlayerName: string,
  hitmanName: string | null,
  koPosition: number,
  eliminatedPlayerUid?: string | null
): Promise<FeedItemData | null> {
  // No longer writes to DB - just broadcast the event
  // The playerId is not available here, so we use a timestamp-based synthetic ID
  const syntheticId = `ko-legacy-${Date.now()}`;

  const feedItem: FeedItemData = {
    id: syntheticId,
    tournament_draft_id: tournamentId,
    item_type: 'knockout',
    author_uid: eliminatedPlayerUid || null,
    author_name: null,
    author_photo_url: null,
    message_text: null,
    eliminated_player_name: eliminatedPlayerName,
    hitman_name: hitmanName,
    ko_position: koPosition,
    created_at: new Date().toISOString(),
  };

  try {
    const broadcast = BroadcastManager.getInstance();
    broadcast.broadcastFeedItem(tournamentId, feedItem);
    console.log(`[FEED] Broadcast knockout (legacy): ${eliminatedPlayerName} eliminated by ${hitmanName || 'unknown'} at position ${koPosition}`);
  } catch (broadcastError) {
    console.error("Failed to broadcast knockout feed item:", broadcastError);
  }

  return feedItem;
}

/**
 * Create a check-in feed item and broadcast it
 * @param playerName - The player's full name
 * @param playerUid - The player's UID (if they're an existing player)
 * @param displayName - Optional display name (e.g., nickname) to show instead of full playerName
 */
export async function createCheckInFeedItem(
  tournamentId: number,
  playerName: string,
  playerUid?: string | null,
  displayName?: string | null
): Promise<FeedItemData | null> {
  try {
    const nameToShow = displayName || playerName;

    // Look up player's photo URL for the broadcast (not stored in DB)
    let photoUrl: string | null = null;
    if (playerUid) {
      const playerData = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT photo_url FROM players WHERE uid = ${playerUid}
      `;
      if (playerData.length > 0 && playerData[0].photo_url) {
        photoUrl = String(playerData[0].photo_url);
      }
    }

    await prisma.$executeRaw`
      INSERT INTO tournament_feed_items
      (tournament_draft_id, item_type, author_uid, author_name, message_text, created_at)
      VALUES (${tournamentId}, 'checkin', ${playerUid}, ${nameToShow}, ${`${nameToShow} checked in`}, NOW())
    `;

    const newItem = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_feed_items WHERE id = LAST_INSERT_ID()
    `;

    if (!newItem.length) return null;

    const item = newItem[0];
    const serializedItem: FeedItemData = {
      id: Number(item.id),
      tournament_draft_id: Number(item.tournament_draft_id),
      item_type: 'checkin',
      author_uid: item.author_uid ? String(item.author_uid) : null,
      author_name: item.author_name ? String(item.author_name) : null,
      author_photo_url: photoUrl,
      message_text: item.message_text ? String(item.message_text) : null,
      eliminated_player_name: null,
      hitman_name: null,
      ko_position: null,
      created_at: item.created_at instanceof Date
        ? item.created_at.toISOString()
        : String(item.created_at),
    };

    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastFeedItem(tournamentId, serializedItem);
    } catch (broadcastError) {
      console.error("Failed to broadcast check-in feed item:", broadcastError);
    }

    return serializedItem;
  } catch (error) {
    console.error("Error creating check-in feed item:", error);
    return null;
  }
}

/**
 * Create a system message feed item
 */
export async function createSystemFeedItem(
  tournamentId: number,
  message: string
): Promise<FeedItemData | null> {
  try {
    await prisma.$executeRaw`
      INSERT INTO tournament_feed_items 
      (tournament_draft_id, item_type, message_text, created_at)
      VALUES (${tournamentId}, 'system', ${message}, NOW())
    `;

    const newItem = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_feed_items WHERE id = LAST_INSERT_ID()
    `;

    if (!newItem.length) return null;

    const item = newItem[0];
    const serializedItem: FeedItemData = {
      id: Number(item.id),
      tournament_draft_id: Number(item.tournament_draft_id),
      item_type: 'system',
      author_uid: null,
      author_name: null,
      author_photo_url: null,
      message_text: item.message_text ? String(item.message_text) : null,
      eliminated_player_name: null,
      hitman_name: null,
      ko_position: null,
      created_at: item.created_at instanceof Date
        ? item.created_at.toISOString()
        : String(item.created_at),
    };

    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastFeedItem(tournamentId, serializedItem);
    } catch (broadcastError) {
      console.error("Failed to broadcast system feed item:", broadcastError);
    }

    return serializedItem;
  } catch (error) {
    console.error("Error creating system feed item:", error);
    return null;
  }
}

/**
 * Create a TD (Tournament Director) message feed item and broadcast it
 */
export async function createTDMessageFeedItem(
  tournamentId: number,
  message: string
): Promise<FeedItemData | null> {
  try {
    await prisma.$executeRaw`
      INSERT INTO tournament_feed_items
      (tournament_draft_id, item_type, message_text, author_name, created_at)
      VALUES (${tournamentId}, 'td_message', ${message}, 'Tournament Director', NOW())
    `;

    const newItem = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_feed_items WHERE id = LAST_INSERT_ID()
    `;

    if (!newItem.length) return null;

    const item = newItem[0];
    const serializedItem: FeedItemData = {
      id: Number(item.id),
      tournament_draft_id: Number(item.tournament_draft_id),
      item_type: 'td_message',
      author_uid: null,
      author_name: 'Tournament Director',
      author_photo_url: null,
      message_text: item.message_text ? String(item.message_text) : null,
      eliminated_player_name: null,
      hitman_name: null,
      ko_position: null,
      created_at: item.created_at instanceof Date
        ? item.created_at.toISOString()
        : String(item.created_at),
    };

    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastFeedItem(tournamentId, serializedItem);
    } catch (broadcastError) {
      console.error("Failed to broadcast TD message feed item:", broadcastError);
    }

    console.log(`[FEED] Created TD message: ${message}`);

    return serializedItem;
  } catch (error) {
    console.error("Error creating TD message feed item:", error);
    return null;
  }
}