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

function getMonthDetails(currentDate: Date, isCurrentMonth: boolean) {
  // Convert to ET and get components
  const etDate = new Date(
    currentDate.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  let year = etDate.getFullYear();
  let month = etDate.getMonth(); // 0-11

  // Adjust for previous month if needed
  if (!isCurrentMonth) {
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
  }

  // Create start and end dates
  const startOfMonth = new Date(Date.UTC(year, month, 1));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // Get month name from the start date
  const monthName = startOfMonth.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "long",
  });

  console.log("Debug - Month calculation:", {
    input: { currentDate, isCurrentMonth },
    output: {
      monthName,
      year,
      dateRange: { start: startOfMonth, end: endOfMonth },
    },
  });

  return {
    monthName,
    year,
    startOfMonth,
    endOfMonth,
  };
}

export async function GET(
  request: Request,
  { params }: { params: { venue: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const venue = decodeURIComponent(params.venue);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    console.log("Debug - Request params:", { venue, isCurrentMonth });

    const currentDate = getCurrentETDate();
    const { monthName, year, startOfMonth, endOfMonth } = getMonthDetails(
      currentDate,
      isCurrentMonth
    );
    const dateCondition = getDateCondition(startOfMonth, endOfMonth);

    // Get top players for the venue
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

    const response = {
      topPlayers: serializeResults(topPlayers as any[]),
      stats: serializeResults(venueStats as any[])[0],
      month: monthName,
      year,
      dateRange: {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
      },
    };

    console.log("Debug - Final response:", {
      month: response.month,
      year: response.year,
      dateRange: response.dateRange,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Venue stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue stats" },
      { status: 500 }
    );
  }
}
