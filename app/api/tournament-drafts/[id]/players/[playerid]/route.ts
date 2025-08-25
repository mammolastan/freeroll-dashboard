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

    const updateResult = await prisma.$executeRaw`
      UPDATE tournament_draft_players 
      SET 
        player_name = ${player_name || ""},
        hitman_name = ${hitman_name || null},
        ko_position = ${ko_position || null},
        placement = ${placement || null},
        updated_at = NOW()
      WHERE id = ${playerId}
    `;

    console.log("Update result:", updateResult);

    if (updateResult === 1) {
      // Fetch the complete updated record
      const updatedPlayerResult = await prisma.$queryRaw`
        SELECT * FROM tournament_draft_players WHERE id = ${playerId}
      `;

      return NextResponse.json((updatedPlayerResult as any[])[0]);
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

    const deleteResult = await prisma.$executeRaw`
      DELETE FROM tournament_draft_players WHERE id = ${playerId}
    `;

    if (deleteResult === 1) {
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
  } finally {
    await prisma.$disconnect();
  }
}
