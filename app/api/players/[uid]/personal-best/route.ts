// app/api/players/[uid]/personal-best/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const playerUID = uid;

    // First, get the player's quarterly stats (excluding current quarter)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;

    const playerQuarterlyStats = await prisma.$queryRaw<
      Array<{
        quarter: number;
        year: number;
        gamesPlayed: bigint;
        totalPoints: bigint;
        finalTables: bigint;
        wins: bigint;
        avgScore: number;
      }>
    >`
      SELECT
        QUARTER(g.date) as quarter,
        YEAR(g.date) as year,
        COUNT(*) as gamesPlayed,
        COALESCE(SUM(a.points), 0) as totalPoints,
        COALESCE(SUM(CASE WHEN a.placement <= 8 THEN 1 ELSE 0 END), 0) as finalTables,
        COALESCE(SUM(CASE WHEN a.placement = 1 THEN 1 ELSE 0 END), 0) as wins,
        COALESCE(AVG(a.player_score), 0) as avgScore
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE p.uid = ${playerUID}
        AND g.date IS NOT NULL
        AND a.placement IS NOT NULL
        AND NOT (QUARTER(g.date) = ${currentQuarter} AND YEAR(g.date) = ${currentYear})
      GROUP BY QUARTER(g.date), YEAR(g.date)
      HAVING gamesPlayed >= 3
      ORDER BY year DESC, quarter DESC
    `;

    if (playerQuarterlyStats.length === 0) {
      return NextResponse.json({
        personalBests: {
          mostFinalTables: null,
          mostTotalPoints: null,
          highestFTP: null,
          highestPowerRating: null,
          bestLeagueRanking: null,
          mostWins: null,
        },
        totalQuarters: 0,
      });
    }

    // Now get rankings for each quarter
    const quarterlyStatsWithRankings = await Promise.all(
      playerQuarterlyStats.map(async (playerQuarter) => {
        // Get all players' stats for this quarter
        const allPlayersInQuarter = await prisma.$queryRaw<
          Array<{
            uid: string;
            totalPoints: bigint;
            avgScore: number;
          }>
        >`
          SELECT
            p.uid,
            COALESCE(SUM(a.points), 0) as totalPoints,
            COALESCE(AVG(a.player_score), 0) as avgScore
          FROM appearances a
          JOIN games g ON g.id = a.game_id
          JOIN venues v ON v.id = g.venue_id
          JOIN players_v2 p ON p.id = a.player_id
          WHERE QUARTER(g.date) = ${playerQuarter.quarter}
            AND YEAR(g.date) = ${playerQuarter.year}
            AND g.date IS NOT NULL
            AND a.placement IS NOT NULL
            AND v.name != 'bonus'
          GROUP BY p.uid
          HAVING COUNT(*) >= 1
          ORDER BY totalPoints DESC, avgScore DESC
        `;

        // Find player's ranking
        const playerTotalPoints = Number(playerQuarter.totalPoints);
        const playerAvgScore = Number(playerQuarter.avgScore);

        let ranking = 1;
        for (const otherPlayer of allPlayersInQuarter) {
          const otherPoints = Number(otherPlayer.totalPoints);
          const otherAvgScore = Number(otherPlayer.avgScore);

          if (
            otherPoints > playerTotalPoints ||
            (otherPoints === playerTotalPoints &&
              otherAvgScore > playerAvgScore)
          ) {
            ranking++;
          } else if (otherPlayer.uid === playerUID) {
            break;
          }
        }

        return {
          quarter: Number(playerQuarter.quarter),
          year: Number(playerQuarter.year),
          gamesPlayed: Number(playerQuarter.gamesPlayed),
          totalPoints: Number(playerQuarter.totalPoints),
          finalTables: Number(playerQuarter.finalTables),
          wins: Number(playerQuarter.wins),
          finalTablePercentage: Number(
            (
              (Number(playerQuarter.finalTables) /
                Number(playerQuarter.gamesPlayed)) *
              100
            ).toFixed(2)
          ),
          avgScore: Number(Number(playerQuarter.avgScore).toFixed(2)),
          leagueRanking: ranking,
          totalPlayersInQuarter: allPlayersInQuarter.length,
        };
      })
    );

    // Find personal bests
    const personalBests = {
      mostFinalTables: quarterlyStatsWithRankings.reduce((max, current) =>
        current.finalTables > (max?.finalTables || 0) ? current : max
      ),
      mostTotalPoints: quarterlyStatsWithRankings.reduce((max, current) =>
        current.totalPoints > (max?.totalPoints || 0) ? current : max
      ),
      highestFTP: quarterlyStatsWithRankings.reduce((max, current) =>
        current.finalTablePercentage > (max?.finalTablePercentage || 0)
          ? current
          : max
      ),
      highestPowerRating: quarterlyStatsWithRankings.reduce((max, current) =>
        current.avgScore > (max?.avgScore || 0) ? current : max
      ),
      bestLeagueRanking: quarterlyStatsWithRankings.reduce((best, current) =>
        current.leagueRanking < (best?.leagueRanking || Infinity)
          ? current
          : best
      ),
      mostWins: quarterlyStatsWithRankings.reduce((max, current) =>
        current.wins > (max?.wins || 0) ? current : max
      ),
    };

    return NextResponse.json({
      personalBests,
      totalQuarters: quarterlyStatsWithRankings.length,
      allQuarters: quarterlyStatsWithRankings,
    });
  } catch (error) {
    console.error("Personal best stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch personal best stats" },
      { status: 500 }
    );
  }
}
