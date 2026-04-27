// app/api/td/action-log/[game_uid]/undo/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getLastAppliedAction,
  markActionUndone,
  getActionHistory,
} from "@/lib/actionLogUtils";
import { TDActionType, TDActionLogEntry } from "@/lib/tdActions";
import { BroadcastManager } from "@/lib/realtime";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/td/action-log/[game_uid]/undo
 * Undoes the most recent applied action for a game
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ game_uid: string }> }
) {
  try {
    const { game_uid } = await params;

    if (!game_uid) {
      return NextResponse.json(
        { error: "game_uid is required" },
        { status: 400 }
      );
    }

    // Get actor from session
    const session = await getServerSession(authOptions);
    const actor_uid = session?.user?.uid || "unknown";

    console.log('[Undo] Attempting undo for game_uid:', game_uid);

    // Get the most recent applied action
    const lastAction = await getLastAppliedAction(game_uid);

    console.log('[Undo] Last applied action found:', lastAction ? {
      id: lastAction.id,
      action_type: lastAction.action_type,
      status: lastAction.status,
      game_uid: lastAction.game_uid,
    } : 'none');

    if (!lastAction) {
      // Debug: Check what actions exist for this game_uid
      const allActions = await prisma.tournament_draft_action_log.findMany({
        where: { game_uid },
        select: { id: true, action_type: true, status: true, game_uid: true },
        take: 5,
      });
      console.log('[Undo] All actions for this game_uid:', allActions);

      return NextResponse.json({
        success: false,
        reason: "nothing_to_undo",
        description: "No actions to undo",
      });
    }

    // Parse the reverse_payload
    const reversePayload = JSON.parse(lastAction.reverse_payload) as Record<
      string,
      unknown
    >;
    const actionType = lastAction.action_type as TDActionType;

    // Execute the reverse operation in a transaction
    await prisma.$transaction(async (tx) => {
      // Execute the appropriate reverse mutation based on action type
      switch (actionType) {
        case "PLAYER_ADDED": {
          // Delete the player that was added
          const playerId = reversePayload.tournament_draft_player_id as number;
          await tx.$executeRaw`
            DELETE FROM tournament_draft_players WHERE id = ${playerId}
          `;
          break;
        }

        case "PLAYER_REMOVED": {
          // Re-insert the player from the snapshot
          const snapshot = reversePayload as {
            id: number;
            tournament_draft_id: number;
            player_name: string;
            player_uid: string | null;
            player_nickname: string | null;
            is_new_player: boolean;
            hitman_name: string | null;
            hitman_uid: string | null;
            ko_position: number | null;
            placement: number | null;
            status: string;
            knockedout_at: string | null;
            added_by: string;
            checked_in_at: string | null;
            t_assign: number | null;
          };

          await tx.$executeRaw`
            INSERT INTO tournament_draft_players
            (id, tournament_draft_id, player_name, player_uid, player_nickname,
             is_new_player, hitman_name, hitman_uid, ko_position, placement,
             status, knockedout_at, added_by, checked_in_at, t_assign)
            VALUES (
              ${snapshot.id},
              ${snapshot.tournament_draft_id},
              ${snapshot.player_name},
              ${snapshot.player_uid},
              ${snapshot.player_nickname},
              ${snapshot.is_new_player ? 1 : 0},
              ${snapshot.hitman_name},
              ${snapshot.hitman_uid},
              ${snapshot.ko_position},
              ${snapshot.placement},
              ${snapshot.status || 'active'},
              ${snapshot.knockedout_at ? new Date(snapshot.knockedout_at) : null},
              ${snapshot.added_by || 'admin'},
              ${snapshot.checked_in_at ? new Date(snapshot.checked_in_at) : null},
              ${snapshot.t_assign || null}
            )
          `;
          break;
        }

        case "PLAYER_CHECKED_IN": {
          // Restore previous checked_in_at value
          const playerId = reversePayload.tournament_draft_player_id as number;
          const previousCheckedInAt = reversePayload.previous_checked_in_at as string | null;

          if (previousCheckedInAt === null) {
            await tx.$executeRaw`
              UPDATE tournament_draft_players
              SET checked_in_at = NULL
              WHERE id = ${playerId}
            `;
          } else {
            await tx.$executeRaw`
              UPDATE tournament_draft_players
              SET checked_in_at = ${new Date(previousCheckedInAt)}
              WHERE id = ${playerId}
            `;
          }
          break;
        }

        case "KO_ASSIGNED": {
          // Restore previous KO state
          const playerId = reversePayload.tournament_draft_player_id as number;
          const previousKoPosition = reversePayload.previous_ko_position as number | null;
          const previousHitmanName = reversePayload.previous_hitman_name as string | null;
          const previousHitmanUid = reversePayload.previous_hitman_uid as string | null;
          const previousKnockedoutAt = reversePayload.previous_knockedout_at as string | null;
          const previousStatus = (reversePayload.previous_status as string) || 'active';

          await tx.$executeRaw`
            UPDATE tournament_draft_players
            SET
              ko_position = ${previousKoPosition},
              hitman_name = ${previousHitmanName},
              hitman_uid = ${previousHitmanUid},
              knockedout_at = ${previousKnockedoutAt ? new Date(previousKnockedoutAt) : null},
              status = ${previousStatus},
              updated_at = NOW()
            WHERE id = ${playerId}
          `;

          // Recalculate ko_positions for remaining knocked out players in this tournament
          // First, get the tournament_draft_id for this player
          const playerResult = await tx.$queryRaw<[{ tournament_draft_id: number }]>`
            SELECT tournament_draft_id FROM tournament_draft_players WHERE id = ${playerId}
          `;

          if (playerResult.length > 0) {
            const draftId = playerResult[0].tournament_draft_id;

            // Get all knocked out players ordered by knockedout_at
            const knockedOutPlayers = await tx.$queryRaw<{ id: number }[]>`
              SELECT id
              FROM tournament_draft_players
              WHERE tournament_draft_id = ${draftId}
                AND knockedout_at IS NOT NULL
              ORDER BY knockedout_at ASC, id ASC
            `;

            // Update each player's ko_position based on their order
            for (let i = 0; i < knockedOutPlayers.length; i++) {
              const p = knockedOutPlayers[i];
              const newKoPosition = i + 1;
              await tx.$executeRaw`
                UPDATE tournament_draft_players
                SET ko_position = ${newKoPosition}
                WHERE id = ${p.id}
              `;
            }
          }
          break;
        }

        case "PLACEMENT_SET": {
          // Restore previous placement
          const playerId = reversePayload.tournament_draft_player_id as number;
          const previousPlacement = reversePayload.previous_placement as number | null;

          await tx.$executeRaw`
            UPDATE tournament_draft_players
            SET placement = ${previousPlacement}, updated_at = NOW()
            WHERE id = ${playerId}
          `;
          break;
        }

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }

      // Mark the action as undone
      await tx.tournament_draft_action_log.update({
        where: { id: lastAction.id },
        data: {
          status: "undone",
          undone_at: new Date(),
          undone_by: actor_uid,
        },
      });
    });

    // Fetch updated action history
    const actions = await getActionHistory(game_uid);

    // Broadcast the update via socket
    // Get tournament_draft_id from the action to broadcast player updates
    const payload = JSON.parse(lastAction.payload) as Record<string, unknown>;
    const tournamentDraftId = payload.tournament_draft_id as number | undefined;

    if (tournamentDraftId) {
      const broadcaster = BroadcastManager.getInstance();
      // Broadcast action log update
      broadcaster.broadcast({
        type: "td:action_log_updated",
        tournamentId: tournamentDraftId,
        data: { game_uid, actions },
        timestamp: new Date(),
      });
    }

    // Build response
    const undoneAction: TDActionLogEntry = {
      id: lastAction.id,
      game_uid: lastAction.game_uid,
      sequence_num: lastAction.sequence_num,
      action_type: actionType,
      description: lastAction.description,
      actor_uid: lastAction.actor_uid,
      payload: JSON.parse(lastAction.payload),
      reverse_payload: reversePayload,
      status: "undone",
      performed_at: lastAction.performed_at.toISOString(),
      undone_at: new Date().toISOString(),
      undone_by: actor_uid,
    };

    return NextResponse.json({
      success: true,
      undone_action: undoneAction,
      description: `Undone: ${lastAction.description}`,
    });
  } catch (error) {
    console.error("Error undoing action:", error);
    return NextResponse.json(
      {
        error: "Failed to undo action",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
