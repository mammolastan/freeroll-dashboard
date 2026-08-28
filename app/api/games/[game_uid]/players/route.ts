// app/api/games/[game_uid]/players/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SCORING_SYSTEM, ScoringSystemConfig, LeagueConfig } from "@/types/league-config";

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
      return NextResponse.json({ players: [], scoringSystem: DEFAULT_SCORING_SYSTEM });
    }

    // Get league scoring config
    const league = await prisma.leagues.findUnique({
      where: { id: game.league_id },
      select: { league_settings: true },
    });

    let scoringSystem: ScoringSystemConfig = DEFAULT_SCORING_SYSTEM;
    if (league?.league_settings) {
      try {
        const settings: LeagueConfig = typeof league.league_settings === 'string'
          ? JSON.parse(league.league_settings)
          : league.league_settings as LeagueConfig;
        if (settings.scoringSystem) {
          scoringSystem = settings.scoringSystem;
        }
      } catch {
        // Use default if parsing fails
      }
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

    return NextResponse.json({ players, scoringSystem, bonusPoints });
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}
