// app/api/venues/list/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentETDate, getDateCondition } from "@/lib/utils";

const prisma = new PrismaClient();

// Set revalidation period to 6 hours (in seconds)
export const revalidate = 21600; // 6 * 60 * 60 = 21600 seconds

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
  hour = 8
): Date {
  return new Date(Date.UTC(year, month, day, hour));
}

function getMonthDetails(currentDate: Date): {
  startDate: Date;
  endDate: Date;
  monthName: string;
  year: number;
} {
  // Get ET date components
  const etOptions = { timeZone: "America/New_York" };
  const etYear = parseInt(
    currentDate.toLocaleString("en-US", { ...etOptions, year: "numeric" })
  );
  const etMonth =
    parseInt(
      currentDate.toLocaleString("en-US", { ...etOptions, month: "numeric" })
    ) - 1;

  // Create date range
  const startDate = createDateFromET(etYear, etMonth);
  const endDate = createDateFromET(etYear, etMonth + 1, 0, 23);
  endDate.setUTCMinutes(59);
  endDate.setUTCSeconds(59);
  endDate.setUTCMilliseconds(999);

  // Get month name from start date
  const monthName = startDate.toLocaleString("en-US", {
    month: "long",
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
    }

    // Get date range and details
    const { startDate, endDate, monthName, year } = getMonthDetails(baseDate);
    const dateCondition = getDateCondition(startDate, endDate);
    const dateConditionP = getDateCondition(startDate, endDate, "p");

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
            p.Name as name,
            p.UID as uid,
            SUM(p.Total_Points) as totalPoints,
            SUM(p.Knockouts) as knockouts,
            COUNT(*) as gamesPlayed,
            pl.nickname
          FROM poker_tournaments p
          LEFT JOIN players pl ON p.UID = pl.uid
          WHERE Venue = ${venue.name}
          AND ${dateConditionP}
          GROUP BY name, uid, pl.nickname
          ORDER BY totalPoints DESC
          LIMIT 5
        `;

        return {
          ...venue,
          topPlayers: serializeResults(topPlayers as any[]),
        };
      })
    );

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
