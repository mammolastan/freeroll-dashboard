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

function getMonthDateRangeET(year: number, month: number) {
  console.log("Debug - getMonthDateRangeET input:", { year, month });

  // Create dates using UTC to avoid timezone shifts
  const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  console.log("Debug - Calculated dates:", {
    startOfMonth: startOfMonth.toISOString(),
    endOfMonth: endOfMonth.toISOString(),
  });

  return { startOfMonth, endOfMonth };
}

function getTargetMonth(currentDate: Date, isCurrentMonth: boolean) {
  // Parse the current date in ET
  const etDate = new Date(
    currentDate.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const currentYear = etDate.getFullYear();
  const currentMonth = etDate.getMonth();

  if (isCurrentMonth) {
    return { year: currentYear, month: currentMonth };
  }

  // Calculate previous month
  if (currentMonth === 0) {
    // If January
    return { year: currentYear - 1, month: 11 }; // Go to December of previous year
  }
  return { year: currentYear, month: currentMonth - 1 };
}

export async function GET(
  request: Request,
  { params }: { params: { venue: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const venue = decodeURIComponent(params.venue);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    console.log("Debug - Request params:", {
      venue,
      isCurrentMonth,
      rawCurrentMonth: searchParams.get("currentMonth"),
    });

    // Get current date in ET
    const currentDate = getCurrentETDate();
    console.log("Debug - currentDate:", currentDate.toISOString());

    // Calculate target month
    const { year, month } = getTargetMonth(currentDate, isCurrentMonth);
    console.log("Debug - Target month calculation:", { year, month });

    // Get date range for the month
    const { startOfMonth, endOfMonth } = getMonthDateRangeET(year, month);
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

    // Create a Date object for the first of the target month to get the month name
    const monthDate = new Date(Date.UTC(year, month, 1));
    const monthName = monthDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "long",
    });

    console.log("Debug - Final response calculation:", {
      monthName,
      year,
      dateRange: {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
      },
    });

    return NextResponse.json({
      topPlayers: serializeResults(topPlayers as any[]),
      stats: serializeResults(venueStats as any[])[0],
      month: monthName,
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
