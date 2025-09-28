// Create: app/api/tournament-drafts/[id]/players/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { emitPlayerJoined } from "@/lib/socketServer";

const prisma = new PrismaClient();

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

        // Update the player
        await tx.$executeRaw`
          UPDATE tournament_draft_players 
          SET 
            player_name = ${updateData.player_name},
            player_uid = ${updateData.player_uid},
            is_new_player = ${updateData.is_new_player || false},
            hitman_name = ${updateData.hitman_name},
            ko_position = ${updateData.ko_position},
            placement = ${updateData.placement},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${playerId} AND tournament_draft_id = ${draftId}
        `;

        // Fetch the updated player data
        const updatedPlayer = await tx.$queryRaw`
          SELECT * FROM tournament_draft_players 
          WHERE id = ${playerId}
        `;

        if ((updatedPlayer as any[]).length > 0) {
          updatedPlayers.push((updatedPlayer as any[])[0]);
        }
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
    return NextResponse.json(
      {
        error: "Failed to batch update players",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
