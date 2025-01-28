// app/api/venues/[venue]/stats/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  getCurrentETDate,
  getMonthDateRange,
  getDateCondition,
} from "@/lib/utils";

const prisma = new PrismaClient();

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

export async function GET(
  request: Request,
  { params }: { params: { venue: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const venue = decodeURIComponent(params.venue);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    // Get target date in ET
    const currentDate = getCurrentETDate();
    const targetDate = isCurrentMonth
      ? currentDate
      : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

    // Get date range for the month
    const { startOfMonth, endOfMonth } = getMonthDateRange(targetDate);
    const dateCondition = getDateCondition(startOfMonth, endOfMonth);

    // Get top players for the venue in the specified month
    const topPlayers = await prisma.$queryRaw`
      SELECT 
        Name,
        UID,
        COUNT(*) as gamesPlayed,
        SUM(Total_Points) as totalPoints,
        SUM(Knockouts) as knockouts,
        AVG(Player_Score) as avgScore
      FROM poker_tournaments
      WHERE Venue = ${venue}
      AND ${dateCondition}
      GROUP BY Name, UID
      HAVING gamesPlayed > 0
      ORDER BY totalPoints DESC
      LIMIT 25
    `;

    // Get venue statistics
    const venueStats = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT File_name) as totalGames,
        COUNT(DISTINCT UID) as uniquePlayers,
        AVG(Total_Points) as avgPoints,
        SUM(Knockouts) as totalKnockouts
      FROM poker_tournaments
      WHERE Venue = ${venue}
      AND ${dateCondition}
    `;

    // Format the response
    return NextResponse.json({
      topPlayers: serializeResults(topPlayers as any[]),
      stats: serializeResults(venueStats as any[])[0],
      month: targetDate.toLocaleString("default", {
        month: "long",
        timeZone: "America/New_York",
      }),
      year: targetDate.getFullYear(),
      dateRange: {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
      },
    });
  } catch (error) {
    console.error("Venue stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue stats" },
      { status: 500 }
    );
  }
}
