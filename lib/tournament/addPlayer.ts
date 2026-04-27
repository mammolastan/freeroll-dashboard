// lib/tournament/addPlayer.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { createCheckInFeedItem } from "@/lib/feed/feedService";
import { RealtimeAPI, BroadcastManager } from "@/lib/realtime";
import {
  logAuditEvent,
  getClientIP,
  getAdminScreen,
  getAuditSession,
  getActorFromSession,
  withActorMetadata,
} from "@/lib/auditlog";
import { getNextSequenceNum, writeActionLog, getGameUidForDraft, getActionHistory } from "@/lib/actionLogUtils";
import { generateActionDescription } from "@/lib/tdActions";

const SEATS_PER_TABLE = 8;

/**
 * Auto-assign a table for a new player.
 * Algorithm: Find the table with the fewest players that isn't full.
 * If all tables are full (or no tables exist), return next table number.
 */
function autoAssignTable(
  tableCounts: Record<number, number>,
  maxTable: number
): number {
  let bestTable = -1;
  let bestCount = Infinity;

  for (let t = 1; t <= maxTable; t++) {
    const count = tableCounts[t] || 0;
    if (count < SEATS_PER_TABLE && count < bestCount) {
      bestCount = count;
      bestTable = t;
    }
  }

  // If all tables are full (or no tables exist), create a new one
  if (bestTable === -1) {
    return maxTable + 1;
  }

  return bestTable;
}

export type AddedBy = "admin" | "self_checkin" | "kiosk";

export interface AddPlayerParams {
  tournamentDraftId: number;
  player_name: string;
  player_nickname?: string | null;
  player_uid?: string | null;
  is_new_player?: boolean;
  added_by: AddedBy;
  request: NextRequest;
  // Additional metadata for audit logging
  auditMetadata?: Record<string, unknown>;
}

export interface AddPlayerResult {
  success: true;
  player: RawQueryResult;
  assignedTable: number;
}

export interface AddPlayerError {
  success: false;
  error: string;
  errorType: "duplicate" | "database_error";
}

export type AddPlayerResponse = AddPlayerResult | AddPlayerError;

/**
 * Shared function to add a player to a tournament draft.
 * Handles duplicate checking, table assignment, database insert,
 * feed item creation, real-time updates, and audit logging.
 */
export async function addPlayerToTournament(
  params: AddPlayerParams
): Promise<AddPlayerResponse> {
  const {
    tournamentDraftId,
    player_name,
    player_nickname = null,
    player_uid = null,
    is_new_player = false,
    added_by,
    request,
    auditMetadata = {},
  } = params;

  try {
    // Check for duplicate player in same tournament
    const existingPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentDraftId} AND player_name = ${player_name}
    `;

    if (existingPlayer.length > 0) {
      return {
        success: false,
        error: "Player already exists in this tournament",
        errorType: "duplicate",
      };
    }

    // Calculate table assignment for the new player
    const activePlayersWithTables = await prisma.$queryRaw<
      { t_assign: number }[]
    >`
      SELECT t_assign FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentDraftId}
        AND (ko_position IS NULL OR ko_position = 0)
        AND t_assign > 0
    `;

    // Build table counts
    const tableCounts: Record<number, number> = {};
    let maxTable = 0;
    for (const p of activePlayersWithTables) {
      const t = p.t_assign;
      if (t > 0) {
        tableCounts[t] = (tableCounts[t] || 0) + 1;
        if (t > maxTable) maxTable = t;
      }
    }

    // If no tables exist yet, start with table 1
    if (maxTable === 0) maxTable = 1;

    const assignedTable = autoAssignTable(tableCounts, maxTable);

    // Insert the player with table assignment
    await prisma.$queryRaw`
      INSERT INTO tournament_draft_players
      (tournament_draft_id, player_name, player_nickname, player_uid, is_new_player, t_assign, added_by, checked_in_at)
      VALUES (${tournamentDraftId}, ${player_name}, ${player_nickname}, ${player_uid}, ${is_new_player}, ${assignedTable}, ${added_by}, UTC_TIMESTAMP())
    `;

    const newPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_draft_players WHERE id = LAST_INSERT_ID()
    `;

    if (!newPlayer.length) {
      return {
        success: false,
        error: "Failed to retrieve newly added player",
        errorType: "database_error",
      };
    }

    const player = newPlayer[0];
    const playerId = typeof player.id === "number" ? player.id : null;

    // Create feed item for check-in (non-blocking)
    try {
      await createCheckInFeedItem(
        tournamentDraftId,
        player_name,
        player_uid,
        player_nickname
      );
    } catch (error) {
      console.error("Failed to create check-in feed item:", error);
    }

    // Emit real-time update (non-blocking)
    try {
      if (playerId) {
        await RealtimeAPI.playerAdded(tournamentDraftId, playerId);
      }
    } catch (error) {
      console.error("Failed to emit real-time update:", error);
    }

    // Audit logging (non-blocking)
    try {
      const session = await getAuditSession();
      const actor = getActorFromSession(session);
      const isAdminAction = added_by === "admin";

      // Determine action type based on how player was added
      const actionType =
        added_by === "self_checkin" ? "PLAYER_CHECKED_IN" : "PLAYER_ADDED";
      const actionCategory = isAdminAction ? "ADMIN" : "PLAYER";

      await logAuditEvent({
        tournamentId: tournamentDraftId,
        actionType,
        actionCategory,
        actorId: isAdminAction ? null : playerId,
        actorName: isAdminAction ? actor.actorName : player_name,
        targetPlayerId: playerId,
        targetPlayerName: player_name,
        previousValue: null,
        newValue: {
          playerId,
          playerName: player_name,
          playerUid: player_uid,
          playerNickname: player_nickname,
          isNewPlayer: is_new_player,
          checkedIn: true,
          tableAssigned: assignedTable,
        },
        metadata: isAdminAction
          ? withActorMetadata(actor, {
              addedBy: added_by,
              tournamentDraftEntryId: playerId,
              playerNickname: player_nickname,
              adminScreen: getAdminScreen(request),
              ...auditMetadata,
            })
          : {
              addedBy: added_by,
              tournamentDraftEntryId: playerId,
              playerNickname: player_nickname,
              adminScreen: getAdminScreen(request),
              ...auditMetadata,
            },
        ipAddress: getClientIP(request),
      });
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
    }

    // TD Action Log for undo system
    try {
      const game_uid = await getGameUidForDraft(tournamentDraftId);
      if (game_uid) {
        const actionLogSession = await getAuditSession();
        const actionLogActor = getActorFromSession(actionLogSession);
        const sequence_num = await getNextSequenceNum(game_uid);
        const payload = {
          tournament_draft_id: tournamentDraftId,
          player_uid: player_uid || null,
          player_name,
          player_nickname: player_nickname || null,
          is_new_player: is_new_player || false,
          added_by,
        };
        const reverse_payload = {
          tournament_draft_player_id: playerId,
        };

        const actionDescription = generateActionDescription('PLAYER_ADDED', payload);

        await writeActionLog({
          game_uid,
          sequence_num,
          action_type: 'PLAYER_ADDED',
          description: actionDescription,
          actor_uid: added_by === 'admin' ? (actionLogActor.actorUid || 'unknown') : (player_uid || 'unknown'),
          payload,
          reverse_payload,
        });

        // Broadcast action log update
        const actions = await getActionHistory(game_uid);
        BroadcastManager.getInstance().broadcastActionLogUpdate(tournamentDraftId, game_uid, actions);
      }
    } catch (actionLogError) {
      console.error('TD Action logging failed:', actionLogError);
    }

    return {
      success: true,
      player,
      assignedTable,
    };
  } catch (error) {
    console.error("Error adding player to tournament:", error);
    return {
      success: false,
      error: "Failed to add player",
      errorType: "database_error",
    };
  }
}
