import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

interface ActiveGameData {
  id: number;
  venueName: string;
  title: string | null;
  remainingCount: number;
  eliminatedCount: number;
  remainingPlayers: string[];
}

/**
 * Public endpoint to get other active games in the league.
 * Used by the "Other Active Games" featured module on the TV screen.
 *
 * Query params:
 *   - exclude: game ID to exclude (the current game being displayed)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { leagueSlug } = await params;
    const leagueId = await getLeagueIdBySlug(leagueSlug);

    if (!leagueId) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    // Get the game ID to exclude (the current game)
    const excludeParam = req.nextUrl.searchParams.get("exclude");
    const excludeId = excludeParam ? parseInt(excludeParam, 10) : null;

    // Find other active games in the league
    // Active = in_progress status AND game_started = true
    const activeGames = await prisma.tournamentDraft.findMany({
      where: {
        league_id: leagueId,
        status: "in_progress",
        game_started: true,
        ...(excludeId && !isNaN(excludeId) ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        venue: true,
        title: true,
        players: {
          select: {
            player_name: true,
            player_nickname: true,
            placement: true, // null = still in, non-null = eliminated
          },
        },
      },
    });

    // Transform to the format needed by the module
    const games: ActiveGameData[] = activeGames.map((game) => {
      const remainingPlayers = game.players
        .filter((p) => p.placement === null)
        .map((p) => p.player_nickname || p.player_name);

      const eliminatedCount = game.players.filter(
        (p) => p.placement !== null
      ).length;

      return {
        id: game.id,
        venueName: game.venue,
        title: game.title,
        remainingCount: remainingPlayers.length,
        eliminatedCount,
        remainingPlayers,
      };
    });

    return NextResponse.json({ games });
  } catch (error) {
    console.error("Error fetching active games:", error);
    return NextResponse.json(
      { error: "Failed to fetch active games" },
      { status: 500 }
    );
  }
}
