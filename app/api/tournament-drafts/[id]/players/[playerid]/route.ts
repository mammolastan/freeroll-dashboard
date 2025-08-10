// app/api/tournament-drafts/[id]/players/[playerId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  try {
    const body = await request.json();
    const playerId = parseInt(params.playerId);
    const { player_name, hitman_name, ko_position, placement } = body;

    await prisma.$queryRaw`
      UPDATE tournament_draft_players 
      SET 
        player_name = ${player_name},
        hitman_name = ${hitman_name},
        ko_position = ${ko_position},
        placement = ${placement},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${playerId}
    `;

    const updatedPlayer = await prisma.$queryRaw`
      SELECT * FROM tournament_draft_players WHERE id = ${playerId}
    `;

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error("Error updating draft player:", error);
    return NextResponse.json(
      { error: "Failed to update player" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  try {
    const playerId = parseInt(params.playerId);

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
