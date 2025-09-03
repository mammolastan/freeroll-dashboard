// app/api/tournament-drafts/[id]/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const draftId = parseInt(params.id);

    const players = await prisma.$queryRaw`
      SELECT * FROM tournament_draft_players 
      WHERE tournament_draft_id = ${draftId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json(players);
  } catch (error) {
    console.error("Error fetching draft players:", error);
    return NextResponse.json(
      { error: "Failed to fetch draft players" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const draftId = parseInt(params.id);
    const { player_name, player_nickname, player_uid, is_new_player } = body;

    // Check for duplicate player in same tournament
    const existingPlayer = await prisma.$queryRaw`
      SELECT id FROM tournament_draft_players 
      WHERE tournament_draft_id = ${draftId} AND player_name = ${player_name}
    `;

    if ((existingPlayer as any[]).length > 0) {
      return NextResponse.json(
        { error: "Player already exists in this tournament" },
        { status: 400 }
      );
    }

    await prisma.$queryRaw`
      INSERT INTO tournament_draft_players 
      (tournament_draft_id, player_name, player_nickname, player_uid, is_new_player, added_by, checked_in_at)
          VALUES (${draftId}, ${player_name}, ${player_nickname}, ${player_uid}, ${
      is_new_player || false
    }, 'admin', UTC_TIMESTAMP())
      `;

    const newPlayer = await prisma.$queryRaw`
      SELECT * FROM tournament_draft_players WHERE id = LAST_INSERT_ID()
    `;

    return NextResponse.json(newPlayer);
  } catch (error) {
    console.error("Error adding draft player:", error);
    return NextResponse.json(
      { error: "Failed to add player" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
