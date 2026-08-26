import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { resolveBlindSchedule, BlindLevel } from "@/lib/blindLevels";

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
  currentBlinds: { smallBlind: number; bigBlind: number } | null;
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
        blind_schedule: true,
        custom_blind_levels: true,
        timer_current_level: true,
        players: {
          select: {
            player_name: true,
            player_nickname: true,
            ko_position: true, // null = still in, non-null = eliminated
          },
        },
      },
    });

    // Transform to the format needed by the module
    const games: ActiveGameData[] = await Promise.all(
      activeGames.map(async (game) => {
        // ko_position is set when a player is knocked out
        // null = still in the game, non-null = eliminated
        const remainingPlayers = game.players
          .filter((p) => p.ko_position === null)
          .map((p) => p.player_nickname || p.player_name);

        const eliminatedCount = game.players.filter(
          (p) => p.ko_position !== null
        ).length;

        // Get current blind levels
        let currentBlinds: { smallBlind: number; bigBlind: number } | null =
          null;
        try {
          let blindLevels: BlindLevel[] = [];

          // Check for custom blind levels first
          if (game.custom_blind_levels) {
            blindLevels = JSON.parse(game.custom_blind_levels) as BlindLevel[];
          } else if (game.blind_schedule) {
            blindLevels = await resolveBlindSchedule(
              game.blind_schedule,
              leagueId
            );
          }

          // Get current level (1-indexed)
          const currentLevelIndex = (game.timer_current_level ?? 1) - 1;
          const currentLevel = blindLevels[currentLevelIndex];

          if (currentLevel && !currentLevel.isbreak) {
            currentBlinds = {
              smallBlind: currentLevel.smallBlind,
              bigBlind: currentLevel.bigBlind,
            };
          }
        } catch (err) {
          console.error(
            `Error resolving blind levels for game ${game.id}:`,
            err
          );
        }

        return {
          id: game.id,
          venueName: game.venue,
          title: game.title,
          remainingCount: remainingPlayers.length,
          eliminatedCount,
          remainingPlayers,
          currentBlinds,
        };
      })
    );

    return NextResponse.json({ games });
  } catch (error) {
    console.error("Error fetching active games:", error);
    return NextResponse.json(
      { error: "Failed to fetch active games" },
      { status: 500 }
    );
  }
}
