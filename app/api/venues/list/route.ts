// app/api/venues/list/route.ts
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

function getMonthDetails(date: Date) {
  const etOptions = { timeZone: "America/New_York" };
  const etYear = parseInt(
    date.toLocaleString("en-US", { ...etOptions, year: "numeric" })
  );
  const etMonth =
    parseInt(date.toLocaleString("en-US", { ...etOptions, month: "numeric" })) -
    1;

  // Create dates in UTC
  const startDate = createDateFromET(etYear, etMonth);
  const endDate = createDateFromET(etYear, etMonth + 1, 0, 23);
  endDate.setUTCMinutes(59);
  endDate.setUTCSeconds(59);
  endDate.setUTCMilliseconds(999);

  // Get month name directly from the original etMonth, not from the UTC date
  const monthName = new Date(etYear, etMonth).toLocaleString("en-US", {
    month: "long",
    timeZone: "America/New_York",
  });

  return { startDate, endDate, monthName, year: etYear };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    // Get current date and adjust if needed
    let baseDate = getCurrentETDate();
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
    const { startDate, endDate, monthName, year } = getMonthDetails(baseDate);
    const dateCondition = getDateCondition(startDate, endDate);

    console.log("TRACE - Using date range:", {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      monthName,
      year,
    });

    // Get all venues
    const venues = await prisma.$queryRaw`
      SELECT DISTINCT 
        Venue as name,
        COUNT(DISTINCT File_name) as totalGames
      FROM poker_tournaments
      WHERE ${dateCondition}
      GROUP BY Venue
      ORDER BY totalGames DESC
    `;

    // Get top players for each venue
    const venuesWithPlayers = await Promise.all(
      (venues as any[]).map(async (venue) => {
        const topPlayers = await prisma.$queryRaw`
          SELECT 
            Name as name,
            UID as uid,
            SUM(Total_Points) as totalPoints,
            SUM(Knockouts) as knockouts,
            COUNT(*) as gamesPlayed
          FROM poker_tournaments
          WHERE Venue = ${venue.name}
          AND ${dateCondition}
          GROUP BY Name, UID
          ORDER BY totalPoints DESC
          LIMIT 5
        `;

        return {
          ...venue,
          topPlayers: serializeResults(topPlayers as any[]),
        };
      })
    );

    console.log("TRACE - Final response:", {
      month: monthName,
      year,
      venueCount: venuesWithPlayers.length,
    });

    return NextResponse.json({
      venues: serializeResults(venuesWithPlayers),
      month: monthName,
      year,
    });
  } catch (error) {
    console.error("Venue list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}
