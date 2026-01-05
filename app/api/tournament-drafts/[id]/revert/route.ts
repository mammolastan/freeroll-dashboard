// app/api/tournament-drafts/[id]/revert/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  try {
    const { id } = await params;
    const draftId = parseInt(id);

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

      // 2. Get all integrated poker tournament entries for this game
      const integratedEntries = await tx.$queryRaw<
        Array<{
          id: number;
          name: string;
          uid: string;
          placement: number;
          knockouts: number;
          hitman: string | null;
        }>
      >`
        SELECT id, Name as name, UID as uid, Placement as placement, 
               Knockouts as knockouts, Hitman as hitman
        FROM poker_tournaments 
        WHERE game_uid = ${draft.game_uid}
      `;

      console.log(
        `Found ${integratedEntries.length} integrated entries to revert`
      );

      // 3. Find new players by checking which players in this tournament
      //    don't exist in the poker_tournaments table for any OTHER game
      const newPlayersToRemove: string[] = [];

      for (const entry of integratedEntries) {
        // Check if this player appears in any other tournaments
        const otherTournaments = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM poker_tournaments 
          WHERE UID = ${entry.uid} AND game_uid != ${draft.game_uid}
        `;

        // IMPORTANT: MySQL returns BigInt, so use == for comparison instead of ===
        const count = Number(otherTournaments[0].count); // Convert to number for safety

        if (count === 0) {
          // This player only exists in this tournament, so they must be new
          newPlayersToRemove.push(entry.uid);
          console.log(
            `NEW PLAYER identified: ${entry.name} (${entry.uid}) - only exists in this tournament`
          );
        } else {
          console.log(
            `Existing player: ${entry.name} (${entry.uid}) - found in ${count} other tournaments`
          );
        }
      }

      console.log(`Found ${newPlayersToRemove.length} new players to remove`);

      // 4. Delete all poker tournament entries for this game
      const deleteResult = await tx.$executeRaw`
        DELETE FROM poker_tournaments WHERE game_uid = ${draft.game_uid}
      `;

      console.log(`Deleted ${deleteResult} poker tournament entries`);

      // 5. Remove new players that don't appear in any other tournaments
      let playersRemoved = 0;
      for (const playerUID of newPlayersToRemove) {
        try {
          // Check if player still exists (safety check)
          const playerExists = await tx.$queryRaw<
            Array<{ uid: string; name: string }>
          >`
            SELECT uid, name FROM players WHERE uid = ${playerUID}
          `;

          if (playerExists.length === 0) {
            console.log(`Player ${playerUID} does not exist - skipping`);
            continue;
          }

          console.log(
            `Attempting to delete player: ${playerExists[0].name} (${playerUID})`
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

          // Now delete the player
          const deletePlayerResult = await tx.$executeRaw`
            DELETE FROM players WHERE uid = ${playerUID}
          `;

          if (deletePlayerResult > 0) {
            playersRemoved++;
            console.log(
              `✓ Successfully removed new player: ${playerExists[0].name} (${playerUID})`
            );
          } else {
            console.log(
              `✗ Failed to remove player ${playerUID} - no rows affected`
            );
          }
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
      };
    });

    console.log("Tournament revert completed successfully:", result);
    return NextResponse.json(result);
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
