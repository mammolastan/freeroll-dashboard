// app/api/players/[uid]/personal-best/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface QuarterlyStats {
  quarter: number;
  year: number;
  gamesPlayed: number;
  totalPoints: number;
  finalTables: number;
  finalTablePercentage: number;
  avgScore: number;
  leagueRanking: number;
  totalPlayersInQuarter: number;
}

export async function GET(
  request: Request,
  { params }: { params: { uid: string } }
) {
  try {
    const playerUID = params.uid;

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
        avgScore: number;
      }>
    >`
      SELECT 
        QUARTER(game_date) as quarter,
        YEAR(game_date) as year,
        COUNT(*) as gamesPlayed,
        COALESCE(SUM(Total_Points), 0) as totalPoints,
        COALESCE(SUM(CASE WHEN Placement <= 8 THEN 1 ELSE 0 END), 0) as finalTables,
        COALESCE(AVG(Player_Score), 0) as avgScore
      FROM poker_tournaments
      WHERE UID = ${playerUID}
        AND game_date IS NOT NULL
        AND Placement IS NOT NULL
        AND NOT (QUARTER(game_date) = ${currentQuarter} AND YEAR(game_date) = ${currentYear})
      GROUP BY QUARTER(game_date), YEAR(game_date)
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
            UID: string;
            totalPoints: bigint;
            avgScore: number;
          }>
        >`
          SELECT 
            UID,
            COALESCE(SUM(Total_Points), 0) as totalPoints,
            COALESCE(AVG(Player_Score), 0) as avgScore
          FROM poker_tournaments
          WHERE QUARTER(game_date) = ${playerQuarter.quarter}
            AND YEAR(game_date) = ${playerQuarter.year}
            AND game_date IS NOT NULL
            AND Placement IS NOT NULL
          GROUP BY UID
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
          } else if (otherPlayer.UID === playerUID) {
            break;
          }
        }

        return {
          quarter: Number(playerQuarter.quarter),
          year: Number(playerQuarter.year),
          gamesPlayed: Number(playerQuarter.gamesPlayed),
          totalPoints: Number(playerQuarter.totalPoints),
          finalTables: Number(playerQuarter.finalTables),
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
  } finally {
    await prisma.$disconnect();
  }
}
