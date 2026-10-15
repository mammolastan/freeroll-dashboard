// app/api/players/[uid]/ranking-history/route.ts
// Returns the player's rank position at the end of each historical competition period
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RankingPeriod {
  period_id: number;
  period_name: string;
  period_type: string;
  end_date: string;
  ranking: number;
  totalPoints: number;
  totalPlayers: number;
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
      // Get all player rankings for this period
      const periodRankings = await prisma.$queryRaw<{ player_id: number; totalPoints: bigint }[]>`
        SELECT
          p.id as player_id,
          CAST(SUM(a.points + COALESCE(g.bonus_points, 0)) AS SIGNED) as totalPoints
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
        const playerPoints = Number(periodRankings[playerIndex].totalPoints);
        rankingHistory.push({
          period_id: period.id,
          period_name: period.name,
          period_type: period.period_type,
          end_date: period.end_date.toISOString(),
          ranking: playerIndex + 1,
          totalPoints: playerPoints,
          totalPlayers: periodRankings.length,
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
