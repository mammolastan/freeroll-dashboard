// app/api/games/recent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getLeagueIdFromRequest } from "@/lib/league-utils";
import { getGamesCacheTags } from "@/lib/rankings-cache";

// Cached function to fetch recent games data
async function fetchRecentGames(leagueId: number) {
  // Get recent games from the games table
  const games = await prisma.$queryRaw<
    Array<{
      game_uid: string;
      game_date: Date;
      venue: string;
      game_title: string | null;
      totalPlayers: bigint;
    }>
  >`
    SELECT
      g.uid as game_uid,
      g.date as game_date,
      v.name as venue,
      td.title as game_title,
      COUNT(a.player_id) as totalPlayers
    FROM games g
    JOIN venues v ON v.id = g.venue_id
    LEFT JOIN tournament_drafts td ON td.id = g.tournament_draft_id
    LEFT JOIN appearances a ON a.game_id = g.id
    WHERE g.date IS NOT NULL
    AND g.league_id = ${leagueId}
    GROUP BY g.id, g.uid, g.date, v.name, td.title
    ORDER BY g.date DESC, g.time DESC
    LIMIT 15
  `;

  // Get detailed information for each game
  const gameDetails = await Promise.all(
    games.map(async (game) => {
      const players = await prisma.$queryRaw<
        Array<{
          name: string;
          placement: number;
          totalPoints: bigint;
          knockouts: bigint;
          venue: string;
          uid: string;
          nickname: string | null;
          game_uid: string;
          photo_url: string | null;
        }>
      >`
        SELECT
          CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
          a.placement,
          (a.points + COALESCE(g.bonus_points, 0)) as totalPoints,
          (SELECT COUNT(*) FROM knockouts k WHERE k.hitman = p.id AND k.game_id = g.id) as knockouts,
          v.name as venue,
          p.uid,
          g.uid as game_uid,
          p.nickname,
          p.photo_url
        FROM appearances a
        JOIN games g ON g.id = a.game_id
        JOIN venues v ON v.id = g.venue_id
        JOIN players_v2 p ON p.id = a.player_id
        WHERE g.uid = ${game.game_uid}
        ORDER BY a.placement ASC
      `;

      // Get top 3 players
      const topThree = players.slice(0, 3).map((player) => ({
        name: player.name,
        points: Number(player.totalPoints) || 0,
        knockouts: Number(player.knockouts) || 0,
        UID: player.uid,
        nickname: player.nickname,
        photo_url: player.photo_url,
      }));

      // Get competition periods for this game
      const periods = await prisma.$queryRaw<
        Array<{ name: string; period_type: string }>
      >`
        SELECT cp.name, cp.period_type
        FROM game_periods gp
        JOIN competition_periods cp ON cp.id = gp.period_id
        WHERE gp.game_id = (SELECT id FROM games WHERE uid = ${game.game_uid})
        ORDER BY cp.display_order ASC
      `;

      return {
        game_uid: game.game_uid,
        venue: game.venue || "Unknown Venue",
        game_title: game.game_title || null,
        date: game.game_date.toISOString(),
        totalPlayers: Number(game.totalPlayers),
        topThree,
        totalKnockouts: players.reduce(
          (sum, player) => sum + (Number(player.knockouts) || 0),
          0
        ),
        periods,
      };
    })
  );

  return {
    games: gameDetails,
  };
}

// Create cached version with dynamic tags
function getCachedRecentGames(leagueId: number) {
  const tags = getGamesCacheTags(leagueId);

  return unstable_cache(
    () => fetchRecentGames(leagueId),
    [`recent-games-${leagueId}`],
    { tags }
  )();
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = await getLeagueIdFromRequest(request);

    const result = await getCachedRecentGames(leagueId);

    return NextResponse.json({
      ...result,
      fetchTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Recent games error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent games" },
      { status: 500 }
    );
  }
}
