// app/api/tournament-drafts/[id]/players/[playerid]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { emitPlayerJoined } from "@/lib/socketServer";
import { broadcastKnockoutEvent } from "@/lib/feed/feedService";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { logAuditEvent, getClientIP, getAdminScreen, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerid: string }> }
) {
  try {
    const { id, playerid } = await params;
    const body = await request.json();
    const playerId = parseInt(playerid);
    const draftId = parseInt(id);
    const { player_name, hitman_name, ko_position, placement } = body;

    console.log("Updating player:", playerId, "with data:", {
      player_name,
      hitman_name,
      ko_position,
      placement,
    });

    // FIRST: Get the current player state to detect knockout
    const currentPlayerResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT player_name, player_nickname, player_uid, ko_position, hitman_name, hitman_uid, placement
      FROM tournament_draft_players
      WHERE id = ${playerId}
    `;

    const currentPlayer = currentPlayerResult.length > 0 ? currentPlayerResult[0] : null;

    // Determine if this is a knockout or undo
    const isKnockout = ko_position !== null && ko_position !== undefined && typeof ko_position === 'number';
    const isUndoKnockout = currentPlayer && currentPlayer.ko_position !== null && (ko_position === null || ko_position === undefined);

    // Look up hitman's UID and nickname if this is a knockout with a hitman
    let hitmanUid: string | null = null;
    let hitmanDisplayName: string | null = hitman_name || null;
    if (isKnockout && hitman_name) {
      const hitmanPlayer = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT player_uid, player_nickname
        FROM tournament_draft_players
        WHERE tournament_draft_id = ${draftId} AND player_name = ${hitman_name}
        LIMIT 1
      `;
      if (hitmanPlayer.length > 0) {
        if (hitmanPlayer[0].player_uid) {
          hitmanUid = String(hitmanPlayer[0].player_uid);
        }
        if (hitmanPlayer[0].player_nickname) {
          hitmanDisplayName = String(hitmanPlayer[0].player_nickname);
        }
      }
    }

    // Build the update query based on knockout state
    let updateResult: number;
    if (isKnockout) {
      // Setting knockout - update status, hitman_uid, and knockedout_at
      // Store hitman's nickname (if exists) in hitman_name for display
      // First, set knockedout_at to NOW() - ko_position will be calculated after
      updateResult = await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          player_name = ${player_name || ""},
          hitman_name = ${hitmanDisplayName},
          hitman_uid = ${hitmanUid},
          placement = ${placement || null},
          status = 'knockedout',
          knockedout_at = NOW(),
          updated_at = NOW()
        WHERE id = ${playerId}
      `;

      // Now recalculate ko_positions for all knocked out players based on knockedout_at order
      const knockedOutPlayers = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT id, knockedout_at
        FROM tournament_draft_players
        WHERE tournament_draft_id = ${draftId}
          AND knockedout_at IS NOT NULL
        ORDER BY knockedout_at ASC, id ASC
      `;

      // Update each player's ko_position based on their order
      for (let i = 0; i < knockedOutPlayers.length; i++) {
        const p = knockedOutPlayers[i];
        const newKoPosition = i + 1;
        await prisma.$executeRaw`
          UPDATE tournament_draft_players
          SET ko_position = ${newKoPosition}
          WHERE id = ${p.id}
        `;
      }
    } else if (isUndoKnockout) {
      // Undoing knockout - reset status and clear knockout fields
      updateResult = await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          player_name = ${player_name || ""},
          hitman_name = ${hitman_name || null},
          hitman_uid = NULL,
          ko_position = NULL,
          placement = ${placement || null},
          status = 'active',
          knockedout_at = NULL,
          updated_at = NOW()
        WHERE id = ${playerId}
      `;

      // Recalculate ko_positions for remaining knocked out players
      const knockedOutPlayers = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT id, knockedout_at
        FROM tournament_draft_players
        WHERE tournament_draft_id = ${draftId}
          AND knockedout_at IS NOT NULL
        ORDER BY knockedout_at ASC, id ASC
      `;

      for (let i = 0; i < knockedOutPlayers.length; i++) {
        const p = knockedOutPlayers[i];
        const newKoPosition = i + 1;
        await prisma.$executeRaw`
          UPDATE tournament_draft_players
          SET ko_position = ${newKoPosition}
          WHERE id = ${p.id}
        `;
      }
    } else {
      // Normal update without knockout change
      updateResult = await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          player_name = ${player_name || ""},
          hitman_name = ${hitman_name || null},
          ko_position = ${ko_position || null},
          placement = ${placement || null},
          updated_at = NOW()
        WHERE id = ${playerId}
      `;
    }

    console.log("Update result:", updateResult);

    if (updateResult === 1) {
      // Fetch the complete updated record
      const updatedPlayerResult = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT * FROM tournament_draft_players WHERE id = ${playerId}
      `;

      const updatedPlayer = updatedPlayerResult[0];

      // Emit Socket.IO event for real-time updates
      // Cast to the expected PlayerData type (has index signature for extra fields)
      emitPlayerJoined(draftId, {
        id: Number(updatedPlayer.id),
        player_name: String(updatedPlayer.player_name || ""),
        player_uid: updatedPlayer.player_uid ? String(updatedPlayer.player_uid) : null,
        player_nickname: updatedPlayer.player_nickname ? String(updatedPlayer.player_nickname) : null,
        ...updatedPlayer,
      });

      // DETECT KNOCKOUT: ko_position went from null to a number
      const wasKnockedOut =
        currentPlayer &&
        currentPlayer.ko_position === null &&
        ko_position !== null &&
        ko_position !== undefined &&
        typeof ko_position === 'number';

      if (wasKnockedOut) {
        // Broadcast knockout event (no DB write - knockouts are computed dynamically)
        try {
          // Use nickname for eliminated player if available
          const eliminatedPlayerName = String(
            currentPlayer.player_nickname || currentPlayer.player_name || player_name
          );

          // Get the knockedout_at timestamp from the updated record
          const knockedoutAt = updatedPlayer.knockedout_at instanceof Date
            ? updatedPlayer.knockedout_at.toISOString()
            : String(updatedPlayer.knockedout_at);

          // Broadcast the knockout event for real-time feed updates
          // hitmanDisplayName already contains the hitman's nickname (if they have one)
          broadcastKnockoutEvent(
            draftId,
            playerId,
            eliminatedPlayerName,
            hitmanDisplayName,
            ko_position,
            knockedoutAt
          );
        } catch (feedError) {
          // Log but don't fail the request if broadcast fails
          console.error("Failed to broadcast knockout event:", feedError);
        }
      }

      // Audit logging for player updates
      const ipAddress = getClientIP(request);
      const adminScreen = getAdminScreen(request);
      const targetPlayerName = String(currentPlayer?.player_nickname || currentPlayer?.player_name || player_name);
      const session = await getAuditSession();
      const actor = getActorFromSession(session);

      // Helper to safely convert raw query values to AuditValue compatible types
      const toAuditValue = (val: unknown): string | number | boolean | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
        return String(val);
      };

      try {
        // Detect knockout state change
        const wasKO = currentPlayer && currentPlayer.ko_position !== null;
        const isNowKO = updatedPlayer.ko_position !== null;

        if (!wasKO && isNowKO) {
          // Knockout was recorded
          await logAuditEvent({
            tournamentId: draftId,
            actionType: 'KNOCKOUT_RECORDED',
            actionCategory: 'ADMIN',
            actorId: null,
            actorName: actor.actorName,
            targetPlayerId: playerId,
            targetPlayerName: targetPlayerName,
            previousValue: {
              placement: toAuditValue(currentPlayer?.placement),
              knockedOutBy: null,
              knockedOutByName: null,
            },
            newValue: {
              placement: toAuditValue(updatedPlayer.placement),
              knockedOutBy: toAuditValue(updatedPlayer.hitman_uid),
              knockedOutByName: hitmanDisplayName,
              koPosition: toAuditValue(updatedPlayer.ko_position),
            },
            metadata: withActorMetadata(actor, {
              knockedOutAt: updatedPlayer.knockedout_at instanceof Date
                ? updatedPlayer.knockedout_at.toISOString()
                : toAuditValue(updatedPlayer.knockedout_at),
              adminScreen,
            }),
            ipAddress,
          });
        } else if (wasKO && !isNowKO) {
          // Knockout was removed (undo)
          await logAuditEvent({
            tournamentId: draftId,
            actionType: 'KNOCKOUT_REMOVED',
            actionCategory: 'ADMIN',
            actorId: null,
            actorName: actor.actorName,
            targetPlayerId: playerId,
            targetPlayerName: targetPlayerName,
            previousValue: {
              placement: toAuditValue(currentPlayer?.placement),
              knockedOutBy: toAuditValue(currentPlayer?.hitman_uid),
              knockedOutByName: toAuditValue(currentPlayer?.hitman_name),
              koPosition: toAuditValue(currentPlayer?.ko_position),
            },
            newValue: {
              placement: null,
              knockedOutBy: null,
              koPosition: null,
            },
            metadata: withActorMetadata(actor, { adminScreen }),
            ipAddress,
          });
        }

        // Detect hitman change (only if not part of knockout/undo)
        if (wasKO && isNowKO && currentPlayer?.hitman_name !== updatedPlayer.hitman_name) {
          await logAuditEvent({
            tournamentId: draftId,
            actionType: 'HITMAN_CHANGED',
            actionCategory: 'ADMIN',
            actorId: null,
            actorName: actor.actorName,
            targetPlayerId: playerId,
            targetPlayerName: targetPlayerName,
            previousValue: {
              hitman: toAuditValue(currentPlayer?.hitman_name),
              hitmanUid: toAuditValue(currentPlayer?.hitman_uid),
            },
            newValue: {
              hitman: toAuditValue(updatedPlayer.hitman_name),
              hitmanUid: toAuditValue(updatedPlayer.hitman_uid),
            },
            metadata: withActorMetadata(actor, { adminScreen }),
            ipAddress,
          });
        }

        // Detect placement change (manual placement, not from knockout)
        if (currentPlayer?.placement !== updatedPlayer.placement && !isNowKO) {
          await logAuditEvent({
            tournamentId: draftId,
            actionType: 'PLACEMENT_SET',
            actionCategory: 'ADMIN',
            actorId: null,
            actorName: actor.actorName,
            targetPlayerId: playerId,
            targetPlayerName: targetPlayerName,
            previousValue: {
              placement: toAuditValue(currentPlayer?.placement),
            },
            newValue: {
              placement: toAuditValue(updatedPlayer.placement),
            },
            metadata: withActorMetadata(actor, { adminScreen }),
            ipAddress,
          });
        }
      } catch (auditError) {
        console.error('Audit logging failed:', auditError);
      }

      return NextResponse.json(updatedPlayer);
    } else {
      return NextResponse.json(
        { error: "Player not found or update failed" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error updating draft player:", error);
    return NextResponse.json(
      {
        error: "Failed to update player",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerid: string }> }
) {
  try {
    const { id, playerid } = await params;
    const playerId = parseInt(playerid);
    const draftId = parseInt(id);

    // Fetch player data before deletion for audit logging
    const entryToDelete = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_draft_players WHERE id = ${playerId}
    `;

    const deleteResult = await prisma.$executeRaw`
      DELETE FROM tournament_draft_players WHERE id = ${playerId}
    `;

    if (deleteResult === 1) {
      // Emit Socket.IO event for real-time updates
      emitPlayerJoined(draftId, { deleted: true, playerId });

      // Audit logging for player removal
      if (entryToDelete.length > 0) {
        const deletedPlayer = entryToDelete[0];
        // Helper to safely convert raw query values to AuditValue compatible types
        const toAuditValue = (val: unknown): string | number | boolean | null => {
          if (val === null || val === undefined) return null;
          if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
          return String(val);
        };
        const session = await getAuditSession();
        const actor = getActorFromSession(session);
        try {
          await logAuditEvent({
            tournamentId: draftId,
            actionType: 'PLAYER_REMOVED',
            actionCategory: 'ADMIN',
            actorId: null,
            actorName: actor.actorName,
            targetPlayerId: playerId,
            targetPlayerName: String(deletedPlayer.player_nickname || deletedPlayer.player_name),
            previousValue: {
              playerId: toAuditValue(deletedPlayer.id),
              playerName: toAuditValue(deletedPlayer.player_name),
              playerUid: toAuditValue(deletedPlayer.player_uid),
              playerNickname: toAuditValue(deletedPlayer.player_nickname),
              placement: toAuditValue(deletedPlayer.placement),
              knockedOutBy: toAuditValue(deletedPlayer.hitman_name),
              koPosition: toAuditValue(deletedPlayer.ko_position),
              checkedIn: deletedPlayer.checked_in_at !== null,
            },
            newValue: null,
            metadata: withActorMetadata(actor, {
              tournamentDraftEntryId: toAuditValue(deletedPlayer.id),
              adminScreen: getAdminScreen(request),
            }),
            ipAddress: getClientIP(request),
          });
        } catch (auditError) {
          console.error('Audit logging failed:', auditError);
        }
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error deleting draft player:", error);
    return NextResponse.json(
      { error: "Failed to delete player" },
      { status: 500 }
    );
  }
}
