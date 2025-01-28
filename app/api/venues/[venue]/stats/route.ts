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

function getDateRangeForMonth(date: Date): {
  startDate: Date;
  endDate: Date;
  monthName: string;
  year: number;
} {
  // Convert input date to ET
  const etDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  console.log(
    "TRACE - ET Date:",
    etDate.toLocaleString("en-US", { timeZone: "America/New_York" })
  );

  // Get year and month from ET date
  const year = etDate.getFullYear();
  const month = etDate.getMonth();
  console.log("TRACE - Year/Month extracted:", { year, month });

  // Create UTC date range
  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // Get month name from start date using ET timezone
  const monthName = startDate.toLocaleString("en-US", {
    month: "long",
    timeZone: "America/New_York",
  });

  console.log("TRACE - Date Range Calculated:", {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    monthName,
    year,
  });

  return { startDate, endDate, monthName, year };
}

export async function GET(
  request: Request,
  { params }: { params: { venue: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const venue = decodeURIComponent(params.venue);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    console.log("TRACE - Request params:", { venue, isCurrentMonth });

    // Get current date and adjust for timezone
    let currentDate = getCurrentETDate();
    console.log(
      "TRACE - Current ET date:",
      currentDate.toLocaleString("en-US", { timeZone: "America/New_York" })
    );

    // If not current month, move back one month
    if (!isCurrentMonth) {
      const etDate = new Date(
        currentDate.toLocaleString("en-US", { timeZone: "America/New_York" })
      );
      etDate.setMonth(etDate.getMonth() - 1);
      currentDate = etDate;
      console.log(
        "TRACE - Adjusted to previous month:",
        currentDate.toLocaleString("en-US", { timeZone: "America/New_York" })
      );
    }

    // Get date range and month details
    const { startDate, endDate, monthName, year } =
      getDateRangeForMonth(currentDate);
    console.log("TRACE - Final date details:", {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      monthName,
      year,
    });

    const dateCondition = getDateCondition(startDate, endDate);

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
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };

    console.log("TRACE - Final response:", {
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
