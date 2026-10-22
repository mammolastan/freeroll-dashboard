// app/api/players/[uid]/ranking-history/route.ts
// Returns the player's rank position at the end of each historical competition period
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cache for 2 hours - historical period data never changes
export const revalidate = 7200;

interface RankingPeriod {
  period_id: number;
  period_name: string;
  period_type: string;
  end_date: string;
  ranking: number;
  totalPoints: number;
  totalPlayers: number;
  gamesPlayed: number;
  finalTables: number;
  ftpPercentage: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;

    // Look up the player's league from their UID
    const player = await prisma.players_v2.findUnique({
      where: { uid },
      select: { id: true, league_id: true },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const leagueId = player.league_id;
    const playerId = player.id;

    // Get all completed periods for the league
    const periods = await prisma.competition_periods.findMany({
      where: {
        league_id: leagueId,
        end_date: { lte: new Date() },
      },
      orderBy: { end_date: 'asc' },
    });

    const rankingHistory: RankingPeriod[] = [];

    for (const period of periods) {
      // Get all player rankings for this period with game counts and final tables
      const periodRankings = await prisma.$queryRaw<{
        player_id: number;
        totalPoints: bigint;
        gamesPlayed: bigint;
        finalTables: bigint;
      }[]>`
        SELECT
          p.id as player_id,
          CAST(SUM(a.points + COALESCE(g.bonus_points, 0)) AS SIGNED) as totalPoints,
          COUNT(DISTINCT g.id) as gamesPlayed,
          SUM(CASE WHEN a.placement <= 8 THEN 1 ELSE 0 END) as finalTables
        FROM game_periods gp
        JOIN games g ON g.id = gp.game_id
        JOIN appearances a ON a.game_id = g.id
        JOIN venues v ON v.id = g.venue_id
        JOIN players_v2 p ON p.id = a.player_id
        WHERE gp.period_id = ${period.id}
        AND g.league_id = ${leagueId}
        AND v.name != 'bonus'
        GROUP BY p.id
        HAVING COUNT(DISTINCT g.id) >= 1
        ORDER BY totalPoints DESC
      `;

      // Find player's rank
      const playerIndex = periodRankings.findIndex(r => r.player_id === playerId);

      if (playerIndex !== -1) {
        const playerData = periodRankings[playerIndex];
        const playerPoints = Number(playerData.totalPoints);
        const gamesPlayed = Number(playerData.gamesPlayed);
        const finalTables = Number(playerData.finalTables);
        const ftpPercentage = gamesPlayed > 0 ? Math.round((finalTables / gamesPlayed) * 100) : 0;

        rankingHistory.push({
          period_id: period.id,
          period_name: period.name,
          period_type: period.period_type,
          end_date: period.end_date.toISOString(),
          ranking: playerIndex + 1,
          totalPoints: playerPoints,
          totalPlayers: periodRankings.length,
          gamesPlayed,
          finalTables,
          ftpPercentage,
        });
      }
    }

    return NextResponse.json({
      uid,
      periods: rankingHistory,
    });
  } catch (error) {
    console.error("Ranking history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ranking history" },
      { status: 500 }
    );
  }
}
