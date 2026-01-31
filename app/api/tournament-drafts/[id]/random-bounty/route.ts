// app/api/tournament-drafts/[id]/random-bounty/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CheckedInPlayer {
  id: number;
  player_name: string;
  player_nickname: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const draftId = parseInt(params.id);

    if (isNaN(draftId)) {
      return NextResponse.json(
        { error: "Invalid tournament draft ID" },
        { status: 400 }
      );
    }

    // Get all checked-in players for this tournament draft
    const players = await prisma.$queryRaw<CheckedInPlayer[]>`
      SELECT id, player_name, player_nickname
      FROM tournament_draft_players
      WHERE tournament_draft_id = ${draftId}
        AND checked_in_at IS NOT NULL
    `;

    if (players.length === 0) {
      return NextResponse.json(
        { error: "No checked-in players found" },
        { status: 404 }
      );
    }

    // Pick a random player
    const randomIndex = Math.floor(Math.random() * players.length);
    const selected = players[randomIndex];

    return NextResponse.json({
      playerName: selected.player_nickname || selected.player_name,
      totalPlayers: players.length,
    });
  } catch (error) {
    console.error("Error fetching random bounty player:", error);
    return NextResponse.json(
      { error: "Failed to fetch random bounty player" },
      { status: 500 }
    );
  }
}
