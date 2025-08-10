// app/api/tournament-drafts/[id]/players/[playerid]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; playerid: string } }
) {
  try {
    const body = await request.json();
    const playerId = parseInt(params.playerid);
    const { player_name, hitman_name, ko_position, placement } = body;

    console.log("Updating player:", playerId, "with data:", {
      player_name,
      hitman_name,
      ko_position,
      placement,
    });

    // Update the player
    const updateResult = await prisma.$executeRaw`
      UPDATE tournament_draft_players 
      SET 
        player_name = ${player_name},
        hitman_name = ${hitman_name},
        ko_position = ${ko_position},
        placement = ${placement},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${playerId}
    `;

    console.log("Update result:", updateResult);

    // Fetch the updated player data
    const updatedPlayerResult = await prisma.$queryRaw`
      SELECT * FROM tournament_draft_players WHERE id = ${playerId}
    `;

    console.log("Updated player from DB:", updatedPlayerResult);

    const updatedPlayer = Array.isArray(updatedPlayerResult)
      ? updatedPlayerResult[0]
      : updatedPlayerResult;

    if (!updatedPlayer) {
      return NextResponse.json(
        { error: "Player not found after update" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error("Error updating draft player:", error);
    return NextResponse.json(
      {
        error: "Failed to update player",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; playerid: string } }
) {
  try {
    const playerId = parseInt(params.playerid);

    await prisma.$queryRaw`
      DELETE FROM tournament_draft_players WHERE id = ${playerId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting draft player:", error);
    return NextResponse.json(
      { error: "Failed to delete player" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
