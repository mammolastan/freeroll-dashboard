// app/api/td/action-log/[game_uid]/undo/[action_id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionHistory } from "@/lib/actionLogUtils";
import { TDActionType, TDActionLogEntry } from "@/lib/tdActions";
import { BroadcastManager } from "@/lib/realtime";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/td/action-log/[game_uid]/undo/[action_id]
 * Undoes a specific action by its ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ game_uid: string; action_id: string }> }
) {
  try {
    const { game_uid, action_id } = await params;
    const actionId = parseInt(action_id);

    if (!game_uid) {
      return NextResponse.json(
        { error: "game_uid is required" },
        { status: 400 }
      );
    }

    if (isNaN(actionId)) {
      return NextResponse.json(
        { error: "Invalid action_id" },
        { status: 400 }
      );
    }

    // Get actor from session
    const session = await getServerSession(authOptions);
    const actor_uid = session?.user?.uid || "unknown";

    // Get the specific action
    const action = await prisma.tournament_draft_action_log.findFirst({
      where: {
        id: actionId,
        game_uid: game_uid,
      },
    });

    if (!action) {
      return NextResponse.json({
        success: false,
        reason: "action_not_found",
        description: "Action not found",
      });
    }

    if (action.status === "undone") {
      return NextResponse.json({
        success: false,
        reason: "already_undone",
        description: "This action has already been undone",
      });
    }

    // Parse the reverse_payload
    const reversePayload = JSON.parse(action.reverse_payload) as Record<
      string,
      unknown
    >;
    const actionType = action.action_type as TDActionType;

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
          };

          await tx.$executeRaw`
            INSERT INTO tournament_draft_players
            (id, tournament_draft_id, player_name, player_uid, player_nickname,
             is_new_player, hitman_name, hitman_uid, ko_position, placement,
             status, knockedout_at, added_by, checked_in_at)
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
              ${snapshot.checked_in_at ? new Date(snapshot.checked_in_at) : null}
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
          // Restore previous KO state and clear hitman claim fields and ko report fields
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
              hitman_claim_uid = NULL,
              hitman_claim_name = NULL,
              hitman_claim_status = 'none',
              hitman_claimed_at = NULL,
              hitman_claim_reviewed_at = NULL,
              hitman_claim_reviewed_by = NULL,
              ko_report_status = 'none',
              ko_report_hitman_uid = NULL,
              ko_reporter_uid = NULL,
              ko_reported_at = NULL,
              ko_report_reviewed_at = NULL,
              ko_report_reviewed_by = NULL,
              updated_at = NOW()
            WHERE id = ${playerId}
          `;

          // Recalculate ko_positions for remaining knocked out players in this tournament
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
        where: { id: action.id },
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
    const payload = JSON.parse(action.payload) as Record<string, unknown>;
    const tournamentDraftId = payload.tournament_draft_id as number | undefined;

    if (tournamentDraftId) {
      const broadcaster = BroadcastManager.getInstance();
      broadcaster.broadcastActionLogUpdate(tournamentDraftId, game_uid, actions);
    }

    // Build response
    const undoneAction: TDActionLogEntry = {
      id: action.id,
      game_uid: action.game_uid,
      sequence_num: action.sequence_num,
      action_type: actionType,
      description: action.description,
      actor_uid: action.actor_uid,
      payload: JSON.parse(action.payload),
      reverse_payload: reversePayload,
      status: "undone",
      performed_at: action.performed_at.toISOString(),
      undone_at: new Date().toISOString(),
      undone_by: actor_uid,
    };

    return NextResponse.json({
      success: true,
      undone_action: undoneAction,
      description: `Undone: ${action.description}`,
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
