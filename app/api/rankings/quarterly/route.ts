// app/api/rankings/quarterly/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { getDateCondition } from "@/lib/utils";

const prisma = new PrismaClient();

function getCurrentQuarter(date: Date = new Date()): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

function getQuarterDates(quarter: number, year: number) {
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0);
  return { startDate, endDate };
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

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentQuarter = getCurrentQuarter(currentDate);

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

    const { startDate, endDate } = getQuarterDates(targetQuarter, targetYear);

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
      WHERE ${getDateCondition(startDate, endDate)}
      GROUP BY Name, UID
      ORDER BY SUM(Total_Points) DESC
    `;

    // Serialize the results to handle BigInt values
    const serializedPlayers = serializeResults(players as any[]);

    // Sort by total points and add rankings
    const rankings = serializedPlayers
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((player, index) => ({
        ...player,
        ranking: index + 1,
        isQualified: index < 40,
      }));

    return NextResponse.json({
      rankings,
      quarter: targetQuarter,
      year: targetYear,
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
