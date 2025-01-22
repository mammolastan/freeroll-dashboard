// app/api/rankings/quarterly/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  getCurrentETDate,
  getQuarterDateRange,
  getDateCondition,
} from "@/lib/utils";

const prisma = new PrismaClient();

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
    const isCurrentQuarter = searchParams.get("currentQuarter") !== "false";

    // Get current date in ET
    const currentDate = getCurrentETDate();
    const currentYear = currentDate.getFullYear();
    const currentQuarter = getCurrentQuarter(currentDate);

    // Determine target quarter and year
    const targetQuarter = isCurrentQuarter
      ? currentQuarter
      : currentQuarter === 1
      ? 4
      : currentQuarter - 1;
    const targetYear = isCurrentQuarter
      ? currentYear
      : currentQuarter === 1
      ? currentYear - 1
      : currentYear;

    // Get date range for the quarter
    const { startOfQuarter, endOfQuarter } = getQuarterDateRange(
      targetQuarter,
      targetYear
    );
    const dateCondition = getDateCondition(startOfQuarter, endOfQuarter);

    // Get player stats for the quarter
    const players = await prisma.$queryRaw`
      SELECT 
        Name as name,
        UID as uid,
        COUNT(DISTINCT File_name) as gamesPlayed,
        CAST(SUM(Total_Points) AS SIGNED) as totalPoints,
        CAST(SUM(Knockouts) AS SIGNED) as totalKnockouts,
        CAST(SUM(CASE WHEN Placement <= 8 THEN 1 ELSE 0 END) AS SIGNED) as finalTables,
        CAST(AVG(Player_Score) AS DECIMAL(10,2)) as avgScore
      FROM poker_tournaments
      WHERE ${dateCondition}
      GROUP BY Name, UID
      HAVING gamesPlayed >= 1
      ORDER BY totalPoints DESC
    `;

    // Serialize the results and add rankings
    const serializedPlayers = serializeResults(players as any[]);
    const rankings = serializedPlayers.map((player, index) => ({
      ...player,
      ranking: index + 1,
      isQualified: index < 40, // Top 40 players qualify
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
  } finally {
    await prisma.$disconnect();
  }
}
