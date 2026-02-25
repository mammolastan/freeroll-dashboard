// app/api/tournament-drafts/[id]/revert/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, getClientIP, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";

interface DraftTournament {
  id: number;
  status: string;
  game_uid: string | null;
  file_name: string | null;
  tournament_date: Date;
  venue: string;
  director_name: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const draftId = parseInt(id);
  const ipAddress = getClientIP(request);

  try {

    if (isNaN(draftId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get tournament draft details
      const draftResult = await tx.$queryRaw<DraftTournament[]>`
        SELECT * FROM tournament_drafts 
        WHERE id = ${draftId} AND status = 'integrated'
      `;

      if (draftResult.length === 0) {
        throw new Error("Tournament draft not found or not integrated");
      }

      const draft = draftResult[0];

      if (!draft.game_uid) {
        throw new Error("No game_uid found for this tournament");
      }

      console.log(`=== REVERT PROCESS ===`);
      console.log(`Draft ID: ${draftId}, Game UID: ${draft.game_uid}`);

      // 2. Get game record and all appearances for this game
      const game = await tx.games.findUnique({
        where: { uid: draft.game_uid },
        include: {
          appearances: {
            include: {
              players_v2: true
            }
          }
        }
      });

      if (!game) {
        throw new Error(`Game not found with uid: ${draft.game_uid}`);
      }

      // Build integrated entries from appearances for audit logging
      const integratedEntries = await Promise.all(
        game.appearances.map(async (a) => {
          // Count knockouts for this player in this game
          const knockoutCount = await tx.knockouts.count({
            where: { game_id: game.id, hitman: a.player_id }
          });
          return {
            id: a.player_id,
            name: `${a.players_v2.first_name || ''} ${a.players_v2.last_name || ''}`.trim(),
            uid: a.players_v2.uid,
            placement: a.placement || 0,
            knockouts: knockoutCount,
            hitman: null as string | null,
          };
        })
      );

      console.log(
        `Found ${integratedEntries.length} integrated entries to revert`
      );

      // 3. Find new players by checking which players in this tournament
      //    don't exist in any OTHER game
      const newPlayersToRemove: string[] = [];

      for (const entry of integratedEntries) {
        // Check if this player appears in any other games
        const otherGamesCount = await tx.appearances.count({
          where: {
            player_id: entry.id,
            game_id: { not: game.id }
          }
        });

        if (otherGamesCount === 0) {
          // This player only exists in this tournament, so they must be new
          newPlayersToRemove.push(entry.uid);
          console.log(
            `NEW PLAYER identified: ${entry.name} (${entry.uid}) - only exists in this tournament`
          );
        } else {
          console.log(
            `Existing player: ${entry.name} (${entry.uid}) - found in ${otherGamesCount} other tournaments`
          );
        }
      }

      console.log(`Found ${newPlayersToRemove.length} new players to remove`);

      // 4. Delete knockouts, appearances, then the game record
      // (Schema doesn't have cascade delete, so we must delete manually)
      await tx.knockouts.deleteMany({
        where: { game_id: game.id }
      });
      console.log(`Deleted knockouts for game ${game.id}`);

      await tx.appearances.deleteMany({
        where: { game_id: game.id }
      });
      console.log(`Deleted appearances for game ${game.id}`);

      await tx.games.delete({
        where: { uid: draft.game_uid }
      });

      console.log(`Deleted game record`);
      const deleteResult = integratedEntries.length; // For backward compat with audit log

      // 5. Remove new players that don't appear in any other tournaments
      let playersRemoved = 0;
      for (const playerUID of newPlayersToRemove) {
        try {
          // Check if player still exists (safety check)
          const playerExists = await tx.players_v2.findUnique({
            where: { uid: playerUID }
          });

          if (!playerExists) {
            console.log(`Player ${playerUID} does not exist - skipping`);
            continue;
          }

          const playerName = `${playerExists.first_name || ''} ${playerExists.last_name || ''}`.trim();
          console.log(
            `Attempting to delete player: ${playerName} (${playerUID})`
          );

          // First, delete any badge entries for this player (foreign key constraint)
          const badgeDeleteResult = await tx.$executeRaw`
            DELETE FROM player_badges WHERE player_uid = ${playerUID}
          `;

          if (badgeDeleteResult > 0) {
            console.log(
              `Deleted ${badgeDeleteResult} badge entries for player ${playerUID}`
            );
          }

          // Now delete the player from players_v2
          await tx.players_v2.delete({
            where: { uid: playerUID }
          });

          playersRemoved++;
          console.log(
            `✓ Successfully removed new player: ${playerName} (${playerUID})`
          );
        } catch (deleteError) {
          console.error(`Error deleting player ${playerUID}:`, deleteError);
        }
      }

      // 6. Clear the player_uid for new players in the draft table (so they can be re-integrated)
      await tx.$queryRaw`
        UPDATE tournament_draft_players 
        SET player_uid = NULL
        WHERE tournament_draft_id = ${draftId} 
        AND is_new_player = true
      `;

      console.log("Cleared player_uid for new players in draft table");

      // 7. Reset tournament draft status and clear integration fields
      await tx.$queryRaw`
        UPDATE tournament_drafts 
        SET 
          status = 'in_progress',
          game_uid = NULL,
          file_name = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${draftId}
      `;

      console.log("Tournament draft status reset to in_progress");

      return {
        success: true,
        message: "Tournament integration reverted successfully",
        entriesDeleted: deleteResult,
        newPlayersRemoved: playersRemoved,
        newPlayersFound: newPlayersToRemove.length,
        revertedFrom: {
          gameUID: draft.game_uid,
          fileName: draft.file_name,
        },
        // Additional data for audit logging
        _auditData: {
          integratedEntries,
          newPlayersRemoved: newPlayersToRemove,
        },
      };
    });

    console.log("Tournament revert completed successfully:", result);

    // Audit logging - run after transaction succeeds
    const session = await getAuditSession();
    const actor = getActorFromSession(session);
    try {
      // Build the list of players that were removed
      const playersRemoved = result._auditData.integratedEntries.map(
        (e: { id: number; name: string; uid: string; placement: number; knockouts: number }) => ({
          playerUid: e.uid,
          playerName: e.name,
          placement: e.placement,
          knockouts: e.knockouts,
        })
      );

      // Calculate total points that were removed (approximate based on placement points)
      const totalPointsRemoved = playersRemoved.reduce(
        (sum: number, p: { placement: number }) => {
          // Replicate points calculation
          let points = 0;
          if (p.placement === 1) points = 10;
          else if (p.placement === 2) points = 7;
          else if (p.placement >= 3 && p.placement <= 8) points = 9 - p.placement;
          return sum + points;
        },
        0
      );

      await logAuditEvent({
        tournamentId: draftId,
        actionType: "TOURNAMENT_REVERTED",
        actionCategory: "ADMIN",
        actorId: null,
        actorName: actor.actorName,
        targetPlayerId: null,
        targetPlayerName: null,
        previousValue: {
          status: "integrated",
          gameUid: result.revertedFrom.gameUID,
          fileName: result.revertedFrom.fileName,
          playerCount: playersRemoved.length,
          totalPointsAwarded: totalPointsRemoved,
        },
        newValue: {
          status: "in_progress",
          gameUid: null,
        },
        metadata: withActorMetadata(actor, {
          playersRemoved,
          newPlayersDeleted: result._auditData.newPlayersRemoved,
          entriesDeleted: result.entriesDeleted,
        }),
        ipAddress,
      });
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
      // Don't throw - allow main operation to succeed
    }

    // Remove internal audit data before returning response
    const { _auditData, ...responseData } = result;
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Revert error:", error);
    return NextResponse.json(
      {
        error: "Revert failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
