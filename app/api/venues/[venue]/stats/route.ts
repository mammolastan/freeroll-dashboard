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

function createDateFromET(
  year: number,
  month: number,
  day = 1,
  hour = 0
): Date {
  return new Date(Date.UTC(year, month, day, hour));
}

function getDateRangeForMonth(date: Date): {
  startDate: Date;
  endDate: Date;
  monthName: string;
  year: number;
} {
  // Convert input date to ET components
  const etOptions = { timeZone: "America/New_York" };
  const etYear = parseInt(
    date.toLocaleString("en-US", { ...etOptions, year: "numeric" })
  );
  const etMonth =
    parseInt(date.toLocaleString("en-US", { ...etOptions, month: "numeric" })) -
    1; // Convert to 0-based month

  console.log("TRACE - Initial ET components:", {
    etYear,
    etMonth: etMonth + 1, // Log 1-based month for clarity
    inputDate: date.toISOString(),
  });

  // Create start and end dates
  const startDate = createDateFromET(etYear, etMonth);
  const endDate = createDateFromET(etYear, etMonth + 1, 0, 23);
  endDate.setUTCMinutes(59);
  endDate.setUTCSeconds(59);
  endDate.setUTCMilliseconds(999);

  // Get the month name from the start date
  const monthName = startDate.toLocaleString("en-US", {
    month: "long",
  });

  console.log("TRACE - Date calculations:", {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    monthName,
    year: etYear,
  });

  return { startDate, endDate, monthName, year: etYear };
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

    // Get current date
    let baseDate = getCurrentETDate();

    // Adjust for previous month if needed
    if (!isCurrentMonth) {
      const etDate = new Date(
        baseDate.toLocaleString("en-US", { timeZone: "America/New_York" })
      );
      etDate.setMonth(etDate.getMonth() - 1);
      baseDate = etDate;
      console.log(
        "TRACE - Adjusted to previous month:",
        baseDate.toLocaleString("en-US", { timeZone: "America/New_York" })
      );
    }

    // Get date range and details
    const { startDate, endDate, monthName, year } =
      getDateRangeForMonth(baseDate);

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
