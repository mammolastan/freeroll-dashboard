// app/api/tournament-drafts/[id]/players/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { emitPlayerJoined } from "@/lib/socketServer";
import { createKnockoutFeedItem } from "@/lib/feed/feedService";
import { prisma } from "@/lib/prisma";
import { TournamentDraftPlayerUpdateInput } from "@/types";
import { logAuditEvent, getClientIP, getAdminScreen, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params;
    const draftId = parseInt(id);
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
      playerName: string;
      playerUid: string | null;
      hitmanName: string | null;
      koPosition: number;
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
          // Reset knockout-related fields
          dataToUpdate.status = 'active';
          dataToUpdate.hitman_uid = null;
          dataToUpdate.knockedout_at = null;
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
            playerName: currentPlayer.player_nickname || currentPlayer.player_name,
            playerUid: currentPlayer.player_uid ?? null,
            hitmanName: updateData.hitman_name ?? currentPlayer.hitman_name ?? null,
            koPosition: updateData.ko_position as number,
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
        // Recalculate ko_positions for all knocked out players based on knockedout_at order
        const knockedOutPlayers = await tx.tournamentDraftPlayer.findMany({
          where: {
            tournament_draft_id: draftId,
            knockedout_at: { not: null }
          },
          orderBy: [
            { knockedout_at: 'asc' },
            { id: 'asc' }
          ],
          select: { id: true }
        });

        // Update each player's ko_position based on their order
        for (let i = 0; i < knockedOutPlayers.length; i++) {
          await tx.tournamentDraftPlayer.update({
            where: { id: knockedOutPlayers[i].id },
            data: { ko_position: i + 1 }
          });
        }
      }

      return updatedPlayers;
    });

    console.log(`Successfully batch updated ${results.length} players`);

    // Emit Socket.IO event for real-time updates
    if (results.length > 0) {
      emitPlayerJoined(draftId, { batchUpdate: true, updatedPlayers: results });
    }

    // Create feed items for any knockouts that occurred
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

        await createKnockoutFeedItem(
          draftId,
          knockout.playerName,
          hitmanDisplayName,
          knockout.koPosition,
          knockout.playerUid
        );
      } catch (feedError) {
        // Log but don't fail the request if feed creation fails
        console.error("Failed to create knockout feed item:", feedError);
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
