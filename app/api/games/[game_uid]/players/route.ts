// app/api/games/[game_uid]/players/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game_uid: string }> }
) {
  try {
    const { game_uid } = await params;
    const identifier = decodeURIComponent(game_uid);

    // Find the game by uid
    const game = await prisma.games.findUnique({
      where: { uid: identifier },
    });

    if (!game) {
      return NextResponse.json({ players: [] });
    }

    // Get all appearances (players) for this game
    const appearances = await prisma.appearances.findMany({
      where: {
        game_id: game.id,
      },
      include: {
        players_v2: true,
      },
      orderBy: {
        placement: "asc",
      },
    });

    // Transform to match the expected response format
    // Total points = placement points (in appearances) + bonus points (in games)
    const bonusPoints = game.bonus_points || 0;
    const players = appearances.map((a) => ({
      id: a.player_id,
      name: `${a.players_v2.first_name || ''} ${a.players_v2.last_name || ''}`.trim(),
      uid: a.players_v2.uid,
      placement: a.placement,
      startPoints: bonusPoints, // Bonus points from game
      hitman: null, // Would need separate query to knockouts table
      totalPoints: (a.points || 0) + bonusPoints,
      playerScore: a.player_score,
    }));

    return NextResponse.json({ players });
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}
