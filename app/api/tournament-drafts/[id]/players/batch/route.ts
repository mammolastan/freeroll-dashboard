// app/api/tournament-drafts/[id]/players/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { emitPlayerJoined } from "@/lib/socketServer";
import { createKnockoutFeedItem } from "@/lib/feed/feedService";
import { prisma } from "@/lib/prisma";
import { TournamentDraftPlayerUpdateInput } from "@/types";

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
      hitmanName: string | null;
      koPosition: number;
    }> = [];

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

        // Update the player using Prisma's update method
        const updatedPlayer = await tx.tournamentDraftPlayer.update({
          where: {
            id: playerId,
          },
          data: dataToUpdate,
        });

        updatedPlayers.push(updatedPlayer);

        // DETECT KNOCKOUT: ko_position went from null to a number
        const wasKnockedOut = 
          currentPlayer &&
          currentPlayer.ko_position === null &&
          'ko_position' in updateData &&
          updateData.ko_position !== null &&
          typeof updateData.ko_position === 'number';

        if (wasKnockedOut) {
          knockoutsToPost.push({
            playerName: currentPlayer.player_name,
            hitmanName: updateData.hitman_name ?? currentPlayer.hitman_name ?? null,
            koPosition: updateData.ko_position as number,
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
        await createKnockoutFeedItem(
          draftId,
          knockout.playerName,
          knockout.hitmanName,
          knockout.koPosition
        );
      } catch (feedError) {
        // Log but don't fail the request if feed creation fails
        console.error("Failed to create knockout feed item:", feedError);
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
