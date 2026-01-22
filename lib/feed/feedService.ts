// ===========================================
// lib/feed/feedService.ts
// ===========================================
// Helper functions for creating tournament feed items

import { prisma } from "@/lib/prisma";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";
import { RawQueryResult } from "@/types";

export interface FeedItemData {
  id: number;
  tournament_draft_id: number;
  item_type: 'knockout' | 'message' | 'checkin' | 'system' | 'td_message';
  author_uid: string | null;
  author_name: string | null;
  message_text: string | null;
  eliminated_player_name: string | null;
  hitman_name: string | null;
  ko_position: number | null;
  created_at: string;
}

/**
 * Create a knockout feed item and broadcast it to connected clients
 */
export async function createKnockoutFeedItem(
  tournamentId: number,
  eliminatedPlayerName: string,
  hitmanName: string | null,
  koPosition: number
): Promise<FeedItemData | null> {
  try {
    // Insert the feed item
    await prisma.$executeRaw`
      INSERT INTO tournament_feed_items 
      (tournament_draft_id, item_type, eliminated_player_name, hitman_name, ko_position, created_at)
      VALUES (${tournamentId}, 'knockout', ${eliminatedPlayerName}, ${hitmanName}, ${koPosition}, NOW())
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
        eliminated_player_name,
        hitman_name,
        ko_position,
        created_at
      FROM tournament_feed_items 
      WHERE id = LAST_INSERT_ID()
    `;

    if (!newItem.length) {
      console.error("Failed to retrieve created knockout feed item");
      return null;
    }

    // Serialize the item
    const item = newItem[0];
    const serializedItem: FeedItemData = {
      id: Number(item.id),
      tournament_draft_id: Number(item.tournament_draft_id),
      item_type: item.item_type as FeedItemData["item_type"],
      author_uid: item.author_uid ? String(item.author_uid) : null,
      author_name: item.author_name ? String(item.author_name) : null,
      message_text: item.message_text ? String(item.message_text) : null,
      eliminated_player_name: item.eliminated_player_name ? String(item.eliminated_player_name) : null,
      hitman_name: item.hitman_name ? String(item.hitman_name) : null,
      ko_position: item.ko_position ? Number(item.ko_position) : null,
      created_at: item.created_at instanceof Date
        ? item.created_at.toISOString()
        : String(item.created_at),
    };

    // Broadcast to connected clients
    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastFeedItem(tournamentId, serializedItem);
    } catch (broadcastError) {
      console.error("Failed to broadcast knockout feed item:", broadcastError);
      // Don't fail the operation if broadcast fails
    }

    console.log(`[FEED] Created knockout feed item: ${eliminatedPlayerName} eliminated by ${hitmanName || 'unknown'} at position ${koPosition}`);
    
    return serializedItem;
  } catch (error) {
    console.error("Error creating knockout feed item:", error);
    return null;
  }
}

/**
 * Create a check-in feed item and broadcast it
 * @param displayName - Optional display name (e.g., nickname) to show instead of full playerName
 */
export async function createCheckInFeedItem(
  tournamentId: number,
  playerName: string,
  displayName?: string | null
): Promise<FeedItemData | null> {
  try {
    const nameToShow = displayName || playerName;
    await prisma.$executeRaw`
      INSERT INTO tournament_feed_items
      (tournament_draft_id, item_type, message_text, created_at)
      VALUES (${tournamentId}, 'checkin', ${`${nameToShow} checked in`}, NOW())
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
      author_uid: null,
      author_name: null,
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