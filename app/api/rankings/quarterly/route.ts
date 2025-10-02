// app/api/rankings/quarterly/route.ts
import { NextResponse } from "next/server";
import {
  getCurrentETDate,
  getQuarterDateRange,
  getDateCondition,
} from "@/lib/utils";
import { prisma } from "@/lib/prisma";

// Set revalidation period to 6 hours (in seconds)
export const revalidate = 21600; // 6 * 60 * 60 = 21600 seconds

function getCurrentQuarter(date: Date = new Date()): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

// Helper function to convert BigInt values
function serializeResults(results: any[]) {
  return results.map((record) => {
    const serialized = { ...record };
    for (let key in serialized) {
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

    const dateConditionP = getDateCondition(startOfQuarter, endOfQuarter, "p");

    // Get player stats for the quarter
    const players = await prisma.$queryRaw`
      SELECT 
        p.Name as name,
        p.UID as uid,
        pl.nickname,
        COUNT(DISTINCT CASE WHEN p.Venue != 'bonus' THEN p.File_name END) as gamesPlayed,
        CAST(SUM(p.Total_Points) AS SIGNED) as totalPoints,
        CAST(SUM(CASE WHEN p.Venue != 'bonus' THEN p.Knockouts ELSE 0 END) AS SIGNED) as totalKnockouts,
        CAST(SUM(CASE WHEN p.Placement <= 8 AND p.Venue != 'bonus' THEN 1 ELSE 0 END) AS SIGNED) as finalTables,
        CAST(AVG(CASE WHEN p.Venue != 'bonus' THEN p.Player_Score END) AS DECIMAL(10,2)) as avgScore
        FROM poker_tournaments p
        LEFT JOIN players pl ON p.UID = pl.uid
        WHERE ${dateConditionP}        
        GROUP BY p.Name, p.UID, pl.nickname
        HAVING gamesPlayed >= 1
        ORDER BY totalPoints DESC
    `;

    // Serialize the results and add rankings
    const serializedPlayers = serializeResults(players as any[]);
    const rankings = serializedPlayers.map((player, index) => ({
      ...player,
      ranking: index + 1,
      isQualified: index < 40, // Top 40 players qualify
      // Ensure avgScore is properly converted to number
      avgScore: player.avgScore ? Number(player.avgScore) : 0,
      // Calculate FTP and PPG in JavaScript to ensure they're properly calculated
      finalTablePercentage:
        player.gamesPlayed > 0
          ? Number(((player.finalTables / player.gamesPlayed) * 100).toFixed(2))
          : 0,
      pointsPerGame:
        player.gamesPlayed > 0
          ? Number((player.totalPoints / player.gamesPlayed).toFixed(2))
          : 0,
    }));

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
