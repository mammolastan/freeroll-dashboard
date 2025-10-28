// Create: app/api/tournament-drafts/[id]/players/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { emitPlayerJoined } from "@/lib/socketServer";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const draftId = parseInt(params.id);
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

    // Use Prisma transaction to update all players atomically
    const results = await prisma.$transaction(async (tx) => {
      const updatedPlayers = [];

      for (const playerUpdate of playersToUpdate) {
        const { id: playerId, ...updateData } = playerUpdate;

        // Build dynamic update data object - only include fields that are present
        const dataToUpdate: any = {
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
        const updatedPlayer = await tx.tournament_draft_players.update({
          where: {
            id: playerId,
          },
          data: dataToUpdate,
        });

        updatedPlayers.push(updatedPlayer);
      }

      return updatedPlayers;
    });

    console.log(`Successfully batch updated ${results.length} players`);

    // Emit Socket.IO event for real-time updates
    if (results.length > 0) {
      emitPlayerJoined(draftId, { batchUpdate: true, updatedPlayers: results });
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
      error instanceof Error ? error.message : "Unknown error";
    const isConnectionError =
      errorMessage.includes("connection") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("ECONNREFUSED");

    return NextResponse.json(
      {
        error: isConnectionError
          ? "Database connection error. Please try again."
          : "Failed to save changes. Please try again.",
        details: errorMessage,
        userMessage: isConnectionError
          ? "Unable to connect to the database. Please check your connection and try again."
          : "An error occurred while saving. Your changes may not have been saved.",
      },
      { status: 500 }
    );
  }
}
