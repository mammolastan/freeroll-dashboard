// app/api/venues/[venue]/stats/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentETDate, getDateCondition } from "@/lib/utils";

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

function getMonthDateRangeET(date: Date) {
  const etDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const year = etDate.getFullYear();
  const month = etDate.getMonth();

  const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return { startOfMonth, endOfMonth };
}

export async function GET(
  request: Request,
  { params }: { params: { venue: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const venue = decodeURIComponent(params.venue);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    console.log("Debug - isCurrentMonth:", isCurrentMonth);

    // Get current date in ET
    const currentDate = getCurrentETDate();
    console.log("Debug - currentDate:", currentDate);

    // Calculate target date in ET
    let targetDate = new Date(currentDate);

    if (!isCurrentMonth) {
      // For previous month, directly manipulate the ET date
      const currentETDate = new Date(
        currentDate.toLocaleString("en-US", { timeZone: "America/New_York" })
      );
      targetDate = new Date(
        currentETDate.getFullYear(),
        currentETDate.getMonth() - 1,
        1
      );
    }

    console.log("Debug - targetDate before range calc:", targetDate);

    // Get date range for the month
    const { startOfMonth, endOfMonth } = getMonthDateRangeET(targetDate);
    console.log("Debug - startOfMonth:", startOfMonth);
    console.log("Debug - endOfMonth:", endOfMonth);

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
      LIMIT 10
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

    // Get month and year in ET
    const month = targetDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "long",
    });
    const year = parseInt(
      targetDate.toLocaleString("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
      })
    );

    console.log("Debug - Final month/year:", month, year);

    // Format the response
    return NextResponse.json({
      topPlayers: serializeResults(topPlayers as any[]),
      stats: serializeResults(venueStats as any[])[0],
      month,
      year,
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
