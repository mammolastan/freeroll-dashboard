// app/api/tournament-drafts/[id]/players/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { emitPlayerJoined } from "@/lib/socketServer";
import { broadcastKnockoutEvent } from "@/lib/feed/feedService";
import { prisma } from "@/lib/prisma";
import { TournamentDraftPlayerUpdateInput } from "@/types";
import { logAuditEvent, getClientIP, getAdminScreen, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";
import { getNextSequenceNum, writeActionLog, getGameUidForDraft, getActionHistory } from "@/lib/actionLogUtils";
import { generateActionDescription, TDActionType } from "@/lib/tdActions";
import { BroadcastManager } from "@/lib/realtime";
import { requireDraftAdmin } from "@/lib/auth-utils";
import { recalculateKoPositions } from "@/lib/tournament/koUtils";

// Shared handler for both PUT and POST (POST needed for sendBeacon on unmount)
async function handleBatchUpdate(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params;
    const draftId = parseInt(id);

    // Verify user is admin for this draft's league
    const auth = await requireDraftAdmin(draftId);
    if (auth.error) return auth.error;

    const { players: playersToUpdate } = body;

    if (!Array.isArray(playersToUpdate) || playersToUpdate.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. Expected array of players to update." },
        { status: 400 }
      );
    }

    console.log(
      `Batch updating ${playersToUpdate.length} players for tournament ${draftId}`
    );

    // Track knockouts for feed items (player name, hitman, ko_position)
    const knockoutsToPost: Array<{
      playerId: number;
      playerName: string;
      playerUid: string | null;
      hitmanName: string | null;
      koPosition: number;
      knockedoutAt: string;
    }> = [];

    // Track audit events to log after transaction completes
    const auditEventsToLog: Array<{
      playerId: number;
      playerName: string;
      actionType: 'KNOCKOUT_RECORDED' | 'KNOCKOUT_REMOVED' | 'HITMAN_CHANGED' | 'PLACEMENT_SET' | 'ENTRY_FIELD_UPDATED';
      previousValue: Record<string, unknown>;
      newValue: Record<string, unknown>;
      metadata?: Record<string, unknown> | null;
    }> = [];

    // Track TD action log entries for undo system
    const actionLogEntries: Array<{
      action_type: TDActionType;
      playerId: number;
      playerName: string;
      payload: Record<string, unknown>;
      reverse_payload: Record<string, unknown>;
    }> = [];

    const batchId = randomUUID();
    const ipAddress = getClientIP(request);
    const adminScreen = getAdminScreen(request);
    const totalInBatch = playersToUpdate.length;

    // Use Prisma transaction to update all players atomically
    const results = await prisma.$transaction(async (tx) => {
      const updatedPlayers = [];

      for (const playerUpdate of playersToUpdate) {
        const { id: playerId, ...updateData } = playerUpdate;

        // FIRST: Get the current player state to detect knockout
        const currentPlayer = await tx.tournamentDraftPlayer.findUnique({
          where: { id: playerId },
          select: {
            player_name: true,
            player_nickname: true,
            player_uid: true,
            ko_position: true,
            hitman_name: true,
          },
        });

        // Build dynamic update data object - only include fields that are present
        const dataToUpdate: TournamentDraftPlayerUpdateInput = {
          updated_at: new Date(),
        };

        // Only include fields that are explicitly present in updateData
        if ('player_name' in updateData) dataToUpdate.player_name = updateData.player_name;
        if ('player_uid' in updateData) dataToUpdate.player_uid = updateData.player_uid;
        if ('is_new_player' in updateData) dataToUpdate.is_new_player = updateData.is_new_player;
        if ('hitman_name' in updateData) dataToUpdate.hitman_name = updateData.hitman_name;
        if ('ko_position' in updateData) dataToUpdate.ko_position = updateData.ko_position;
        if ('placement' in updateData) dataToUpdate.placement = updateData.placement;
        if ('player_nickname' in updateData) dataToUpdate.player_nickname = updateData.player_nickname;

        // DETECT KNOCKOUT: ko_position went from null to a number
        const isKnockout =
          currentPlayer &&
          currentPlayer.ko_position === null &&
          'ko_position' in updateData &&
          updateData.ko_position !== null &&
          typeof updateData.ko_position === 'number';

        // DETECT UNDO: ko_position went from a number to null
        const isUndoKnockout =
          currentPlayer &&
          currentPlayer.ko_position !== null &&
          'ko_position' in updateData &&
          updateData.ko_position === null;

        // Handle knockout status updates
        if (isKnockout) {
          // Look up hitman's UID
          const hitmanName = updateData.hitman_name ?? currentPlayer.hitman_name;
          if (hitmanName) {
            const hitmanPlayer = await tx.tournamentDraftPlayer.findFirst({
              where: {
                tournament_draft_id: draftId,
                player_name: hitmanName,
              },
              select: {
                player_uid: true,
              },
            });
            if (hitmanPlayer?.player_uid) {
              dataToUpdate.hitman_uid = hitmanPlayer.player_uid;
            }
          }
          dataToUpdate.status = 'knockedout';
          // Store UTC time (same as other feed items like checkins)
          dataToUpdate.knockedout_at = new Date();
        } else if (isUndoKnockout) {
          // Reset knockout-related fields, hitman claim fields, and ko report fields
          dataToUpdate.status = 'active';
          dataToUpdate.hitman_uid = null;
          dataToUpdate.knockedout_at = null;
          // Clear hitman claim fields
          dataToUpdate.hitman_claim_uid = null;
          dataToUpdate.hitman_claim_name = null;
          dataToUpdate.hitman_claim_status = 'none';
          dataToUpdate.hitman_claimed_at = null;
          dataToUpdate.hitman_claim_reviewed_at = null;
          dataToUpdate.hitman_claim_reviewed_by = null;
          // Clear ko report fields
          dataToUpdate.ko_report_status = 'none';
          dataToUpdate.ko_report_hitman_uid = null;
          dataToUpdate.ko_reporter_uid = null;
          dataToUpdate.ko_reported_at = null;
          dataToUpdate.ko_report_reviewed_at = null;
          dataToUpdate.ko_report_reviewed_by = null;
        }

        // Update the player using Prisma's update method
        const updatedPlayer = await tx.tournamentDraftPlayer.update({
          where: {
            id: playerId,
          },
          data: dataToUpdate,
        });

        updatedPlayers.push(updatedPlayer);

        if (isKnockout) {
          knockoutsToPost.push({
            playerId,
            playerName: currentPlayer.player_nickname || currentPlayer.player_name,
            playerUid: currentPlayer.player_uid ?? null,
            hitmanName: updateData.hitman_name ?? currentPlayer.hitman_name ?? null,
            koPosition: updateData.ko_position as number,
            knockedoutAt: (dataToUpdate.knockedout_at as Date).toISOString(),
          });

          // Track TD action log entry for KO_ASSIGNED
          actionLogEntries.push({
            action_type: 'KO_ASSIGNED',
            playerId,
            playerName: currentPlayer.player_nickname || currentPlayer.player_name,
            payload: {
              tournament_draft_id: draftId,
              tournament_draft_player_id: playerId,
              player_name: currentPlayer.player_nickname || currentPlayer.player_name,
              ko_position: updateData.ko_position,
              hitman_name: updateData.hitman_name ?? currentPlayer.hitman_name ?? null,
              hitman_uid: dataToUpdate.hitman_uid ?? null,
            },
            reverse_payload: {
              tournament_draft_id: draftId,
              tournament_draft_player_id: playerId,
              previous_ko_position: null,
              previous_hitman_name: null,
              previous_hitman_uid: null,
              previous_knockedout_at: null,
              previous_status: 'active',
            },
          });

          // Track audit event for knockout
          auditEventsToLog.push({
            playerId,
            playerName: currentPlayer.player_nickname || currentPlayer.player_name,
            actionType: 'KNOCKOUT_RECORDED',
            previousValue: {
              placement: currentPlayer.ko_position,
              knockedOutBy: null,
              knockedOutByName: null,
            },
            newValue: {
              placement: updateData.ko_position,
              knockedOutBy: dataToUpdate.hitman_uid ?? null,
              knockedOutByName: updateData.hitman_name ?? currentPlayer.hitman_name ?? null,
              koPosition: updateData.ko_position,
            },
            metadata: {
              batchId,
              batchOperation: true,
              totalInBatch,
              knockedOutAt: dataToUpdate.knockedout_at instanceof Date
                ? dataToUpdate.knockedout_at.toISOString()
                : null,
              adminScreen,
            },
          });
        }

        if (isUndoKnockout) {
          // Track audit event for knockout removal
          auditEventsToLog.push({
            playerId,
            playerName: currentPlayer.player_nickname || currentPlayer.player_name,
            actionType: 'KNOCKOUT_REMOVED',
            previousValue: {
              placement: currentPlayer.ko_position,
              knockedOutBy: currentPlayer.hitman_name,
              koPosition: currentPlayer.ko_position,
            },
            newValue: {
              placement: null,
              knockedOutBy: null,
              koPosition: null,
            },
            metadata: {
              batchId,
              batchOperation: true,
              totalInBatch,
              adminScreen,
            },
          });
        }

        // Track hitman change (when no knockout state change)
        if (!isKnockout && !isUndoKnockout && currentPlayer && 'hitman_name' in updateData) {
          const oldHitman = currentPlayer.hitman_name;
          const newHitman = updateData.hitman_name;
          if (oldHitman !== newHitman) {
            auditEventsToLog.push({
              playerId,
              playerName: currentPlayer.player_nickname || currentPlayer.player_name,
              actionType: 'HITMAN_CHANGED',
              previousValue: {
                hitmanName: oldHitman,
              },
              newValue: {
                hitmanName: newHitman,
              },
              metadata: {
                batchId,
                batchOperation: true,
                totalInBatch,
                adminScreen,
              },
            });
          }
        }

        // Track other field changes (when not a knockout event)
        if (!isKnockout && !isUndoKnockout && currentPlayer) {
          const fieldChanges: string[] = [];
          const previousValue: Record<string, unknown> = {};
          const newValue: Record<string, unknown> = {};

          // Check player_name change
          if ('player_name' in updateData && updateData.player_name !== currentPlayer.player_name) {
            fieldChanges.push('player_name');
            previousValue.player_name = currentPlayer.player_name;
            newValue.player_name = updateData.player_name;
          }

          // Check player_nickname change
          if ('player_nickname' in updateData && updateData.player_nickname !== currentPlayer.player_nickname) {
            fieldChanges.push('player_nickname');
            previousValue.player_nickname = currentPlayer.player_nickname;
            newValue.player_nickname = updateData.player_nickname;
          }

          // Log if there are field changes (excluding hitman which is logged separately)
          if (fieldChanges.length > 0) {
            auditEventsToLog.push({
              playerId,
              playerName: currentPlayer.player_nickname || currentPlayer.player_name,
              actionType: 'ENTRY_FIELD_UPDATED',
              previousValue,
              newValue,
              metadata: {
                batchId,
                batchOperation: true,
                totalInBatch,
                fieldsChanged: fieldChanges,
                adminScreen,
              },
            });
          }
        }
      }

      // If any knockouts or undo knockouts occurred, recalculate all ko_positions
      const anyKnockoutChanges = playersToUpdate.some(p => 'ko_position' in p);
      if (anyKnockoutChanges) {
        await recalculateKoPositions(draftId, tx);
      }

      return updatedPlayers;
    });

    console.log(`Successfully batch updated ${results.length} players`);

    // Emit Socket.IO event for real-time updates
    if (results.length > 0) {
      emitPlayerJoined(draftId, { batchUpdate: true, updatedPlayers: results });
    }

    // Broadcast feed items for any knockouts that occurred
    // Do this AFTER the transaction completes successfully
    for (const knockout of knockoutsToPost) {
      try {
        // Look up hitman's nickname if hitman exists
        let hitmanDisplayName = knockout.hitmanName;
        if (knockout.hitmanName) {
          const hitmanPlayer = await prisma.tournamentDraftPlayer.findFirst({
            where: {
              tournament_draft_id: draftId,
              player_name: knockout.hitmanName,
            },
            select: {
              player_nickname: true,
            },
          });
          if (hitmanPlayer?.player_nickname) {
            hitmanDisplayName = hitmanPlayer.player_nickname;
          }
        }

        broadcastKnockoutEvent(
          draftId,
          knockout.playerId,
          knockout.playerName,
          hitmanDisplayName,
          knockout.koPosition,
          knockout.knockedoutAt
        );
      } catch (feedError) {
        // Log but don't fail the request if broadcast fails
        console.error("Failed to broadcast knockout event:", feedError);
      }
    }

    // Log audit events for all tracked changes
    const session = await getAuditSession();
    const actor = getActorFromSession(session);
    for (const auditEvent of auditEventsToLog) {
      try {
        await logAuditEvent({
          tournamentId: draftId,
          actionType: auditEvent.actionType,
          actionCategory: 'ADMIN',
          actorId: null,
          actorName: actor.actorName,
          targetPlayerId: auditEvent.playerId,
          targetPlayerName: auditEvent.playerName,
          previousValue: auditEvent.previousValue as Record<string, string | number | boolean | null>,
          newValue: auditEvent.newValue as Record<string, string | number | boolean | null>,
          metadata: withActorMetadata(actor, auditEvent.metadata as Record<string, string | number | boolean | null> | null),
          ipAddress,
        });
      } catch (auditError) {
        console.error('Audit logging failed:', auditError);
      }
    }

    // TD Action Log for undo system
    if (actionLogEntries.length > 0) {
      try {
        const game_uid = await getGameUidForDraft(draftId);
        if (game_uid) {
          for (const entry of actionLogEntries) {
            const sequence_num = await getNextSequenceNum(game_uid);
            const actionDescription = generateActionDescription(entry.action_type, entry.payload);

            await writeActionLog({
              game_uid,
              sequence_num,
              action_type: entry.action_type,
              description: actionDescription,
              actor_uid: actor.actorUid || 'unknown',
              payload: entry.payload,
              reverse_payload: entry.reverse_payload,
            });

            console.log('[ActionLog] Logged action:', entry.action_type, 'for player:', entry.playerName);
          }

          // Broadcast action log update once after all entries are written
          const actions = await getActionHistory(game_uid);
          BroadcastManager.getInstance().broadcastActionLogUpdate(draftId, game_uid, actions);
        }
      } catch (actionLogError) {
        console.error('TD Action logging failed:', actionLogError);
      }
    }

    return NextResponse.json({
      success: true,
      updatedPlayers: results,
      updateCount: results.length,
    });
  } catch (error) {
    console.error("Error in batch update:", error);

    // Return a proper JSON error response with detailed information
    const errorMessage =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        error: "Failed to batch update players",
        userMessage:
          "Unable to save changes. Please check your connection and try again.",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// PUT handler (standard usage)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleBatchUpdate(request, context);
}

// POST handler (for sendBeacon on component unmount)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleBatchUpdate(request, context);
}
