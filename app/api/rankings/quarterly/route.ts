// app/api/rankings/quarterly/route.ts
import { NextResponse } from "next/server";
import {
  getCurrentETDate,
  getQuarterDateRange,
} from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { Prisma } from "@prisma/client";

// Set revalidation period to 6 hours (in seconds)
export const revalidate = 21600; // 6 * 60 * 60 = 21600 seconds

function getCurrentQuarter(date: Date = new Date()): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

// Helper function to convert BigInt values
function serializeResults(results: RawQueryResult[]) {
  return results.map((record) => {
    const serialized = { ...record };
    for (const key in serialized) {
      if (typeof serialized[key] === "bigint") {
        serialized[key] = Number(serialized[key]);
      }
    }
    return serialized;
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Check for specific quarter and year parameters first
    const quarterParam = searchParams.get("quarter");
    const yearParam = searchParams.get("year");

    let targetQuarter: number;
    let targetYear: number;

    if (quarterParam && yearParam) {
      // Use specific quarter and year from parameters
      targetQuarter = parseInt(quarterParam);
      targetYear = parseInt(yearParam);

      // Validate quarter (1-4) and year
      if (
        targetQuarter < 1 ||
        targetQuarter > 4 ||
        targetYear < 2020 ||
        targetYear > new Date().getFullYear() + 1
      ) {
        return NextResponse.json(
          { error: "Invalid quarter or year parameter" },
          { status: 400 }
        );
      }
    } else {
      // Fall back to the old currentQuarter logic for backward compatibility
      const isCurrentQuarter = searchParams.get("currentQuarter") !== "false";

      // Get current date in ET
      const currentDate = getCurrentETDate();
      const currentYear = currentDate.getFullYear();
      const currentQuarter = getCurrentQuarter(currentDate);

      // Determine target quarter and year
      targetQuarter = isCurrentQuarter
        ? currentQuarter
        : currentQuarter === 1
        ? 4
        : currentQuarter - 1;
      targetYear = isCurrentQuarter
        ? currentYear
        : currentQuarter === 1
        ? currentYear - 1
        : currentYear;
    }

    // Get date range for the quarter
    const { startOfQuarter, endOfQuarter } = getQuarterDateRange(
      targetQuarter,
      targetYear
    );

    const dateCondition = Prisma.sql`g.date >= DATE(${startOfQuarter}) AND g.date <= DATE(${endOfQuarter})`;

    // Get player stats for the quarter using the new schema
    const players = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
        p.uid,
        p.nickname,
        p.photo_url,
        COUNT(DISTINCT CASE WHEN v.name != 'bonus' THEN g.id END) as gamesPlayed,
        CAST(SUM(a.points) AS SIGNED) as totalPoints,
        CAST((
          SELECT COUNT(*) FROM knockouts k
          JOIN games kg ON kg.id = k.game_id
          JOIN venues kv ON kv.id = kg.venue_id
          WHERE k.hitman = p.id
          AND kv.name != 'bonus'
          AND kg.date >= DATE(${startOfQuarter}) AND kg.date <= DATE(${endOfQuarter})
        ) AS SIGNED) as totalKnockouts,
        CAST(SUM(CASE WHEN a.placement <= 8 AND v.name != 'bonus' THEN 1 ELSE 0 END) AS SIGNED) as finalTables,
        CAST(AVG(CASE WHEN v.name != 'bonus' THEN a.player_score END) AS DECIMAL(10,2)) as avgScore
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE ${dateCondition}
      GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname, p.photo_url
      HAVING gamesPlayed >= 1
      ORDER BY totalPoints DESC
    `;

    // Serialize the results and add rankings
    const serializedPlayers = serializeResults(players);
    const rankings = serializedPlayers.map((player, index) => {
      const gamesPlayed = Number(player.gamesPlayed) || 0;
      const finalTables = Number(player.finalTables) || 0;
      const totalPoints = Number(player.totalPoints) || 0;

      return {
        ...player,
        ranking: index + 1,
        isQualified: index < 40, // Top 40 players qualify
        // Convert photo_url to photoUrl (camelCase)
        photoUrl: player.photo_url,
        // Ensure avgScore is properly converted to number
        avgScore: player.avgScore ? Number(player.avgScore) : 0,
        // Calculate FTP and PPG in JavaScript to ensure they're properly calculated
        finalTablePercentage:
          gamesPlayed > 0
            ? Number(((finalTables / gamesPlayed) * 100).toFixed(2))
            : 0,
        pointsPerGame:
          gamesPlayed > 0
            ? Number((totalPoints / gamesPlayed).toFixed(2))
            : 0,
      };
    });

    // Return the results with quarter and year
    return NextResponse.json({
      rankings,
      quarter: targetQuarter,
      year: targetYear,
      dateRange: {
        start: startOfQuarter.toISOString(),
        end: endOfQuarter.toISOString(),
      },
    });
  } catch (error) {
    console.error("Quarterly rankings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quarterly rankings" },
      { status: 500 }
    );
  }
}
