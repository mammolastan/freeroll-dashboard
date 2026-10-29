// app/api/games/[game_uid]/placements/route.ts
// Bulk update placements for all players in a game
// Recalculates points based on league scoring config

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPointsForPlacement } from "@/lib/scoring";
import { DEFAULT_SCORING_SYSTEM, ScoringSystemConfig, LeagueConfig } from "@/types/league-config";
import { revalidateRankingsCache } from "@/lib/rankings-cache";

interface PlacementUpdate {
  playerId: number; // This is players_v2.id
}

function calculatePlayerScore(placement: number, totalPlayers: number): number {
  return Math.log((totalPlayers + 1) / placement);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ game_uid: string }> }
) {
  try {
    const { game_uid } = await params;
    const body = await request.json();
    const { playerOrder } = body as { playerOrder: PlacementUpdate[] };

    if (!playerOrder || !Array.isArray(playerOrder) || playerOrder.length === 0) {
      return NextResponse.json(
        { error: "playerOrder array is required" },
        { status: 400 }
      );
    }

    // Find the game
    const game = await prisma.games.findUnique({
      where: { uid: game_uid },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    // Fetch league scoring config
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

    const totalPlayers = playerOrder.length;

    // Update all appearances in a transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < playerOrder.length; i++) {
        const { playerId } = playerOrder[i];
        const placement = i + 1; // 1-indexed placement
        const points = getPointsForPlacement(placement, scoringSystem);
        const playerScore = calculatePlayerScore(placement, totalPlayers);

        await tx.appearances.update({
          where: {
            game_id_player_id: {
              game_id: game.id,
              player_id: playerId,
            },
          },
          data: {
            placement,
            points,
            player_score: playerScore,
          },
        });
      }
    });

    // Fetch updated players to return
    const appearances = await prisma.appearances.findMany({
      where: { game_id: game.id },
      include: { players_v2: true },
      orderBy: { placement: "asc" },
    });

    const bonusPoints = game.bonus_points || 0;
    const players = appearances.map((a) => ({
      id: a.player_id,
      name: `${a.players_v2.first_name || ""} ${a.players_v2.last_name || ""}`.trim(),
      uid: a.players_v2.uid,
      placement: a.placement,
      startPoints: bonusPoints,
      hitman: null,
      totalPoints: (a.points || 0) + bonusPoints,
      playerScore: a.player_score,
    }));

    // Invalidate all rankings cache for this league (simpler approach for admin edits)
    try {
      await revalidateRankingsCache(game.league_id);
    } catch (cacheError) {
      console.error("Rankings cache invalidation failed:", cacheError);
      // Don't throw - allow main operation to succeed
    }

    return NextResponse.json({
      success: true,
      players,
    });
  } catch (error) {
    console.error("Error updating placements:", error);
    return NextResponse.json(
      { error: "Failed to update placements" },
      { status: 500 }
    );
  }
}
