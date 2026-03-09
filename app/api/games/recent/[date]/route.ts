// app/api/games/recent/[date]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdFromRequest } from "@/lib/league-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    const leagueId = await getLeagueIdFromRequest(request);

    // Convert input date string to a Date object
    const selectedDate = new Date(date);

    // Get games from the games table for this date
    const games = await prisma.games.findMany({
      where: {
        date: selectedDate,
        league_id: leagueId,
      },
      orderBy: {
        date: "desc",
      },
      include: {
        venues: true,
        _count: {
          select: { appearances: true }
        }
      },
    });

    // Transform games to response format
    const gamesWithDetails = games.map((game) => ({
      id: game.id,
      gameDate: game.date,
      fileName: null, // No longer stored in games table
      season: game.season,
      venue: game.venues.name,
      gameUid: game.uid,
      game_uid: game.uid,
      playerCount: game._count.appearances,
      processedAt: game.created, // Use game creation timestamp
    }));

    return NextResponse.json({ games: gamesWithDetails });
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}
