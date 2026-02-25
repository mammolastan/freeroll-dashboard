// app/api/venues/list/route.ts
import { NextResponse } from "next/server";
import { getCurrentETDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { Prisma } from "@prisma/client";

// Set revalidation period to 6 hours (in seconds)
export const revalidate = 21600; // 6 * 60 * 60 = 21600 seconds

function serializeResults(results: RawQueryResult[]): RawQueryResult[] {
  return results.map((record) => {
    const serialized = { ...record };
    for (const key in serialized) {
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
    const dateCondition = Prisma.sql`g.date >= DATE(${startDate}) AND g.date <= DATE(${endDate})`;

    // Get all venues with game counts
    const venues = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        v.name,
        COUNT(DISTINCT g.id) as totalGames
      FROM venues v
      JOIN games g ON g.venue_id = v.id
      WHERE ${dateCondition}
      AND v.name != 'bonus'
      GROUP BY v.id, v.name
      ORDER BY totalGames DESC
    `;

    const venuesWithPlayers = await Promise.all(
      venues.map(async (venue) => {
        const topPlayers = await prisma.$queryRaw<RawQueryResult[]>`
          SELECT
            CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
            p.uid,
            SUM(a.points) as totalPoints,
            (SELECT COUNT(*) FROM knockouts k
             JOIN games kg ON kg.id = k.game_id
             JOIN venues kv ON kv.id = kg.venue_id
             WHERE k.hitman = p.id
             AND kv.name = ${venue.name}
             AND kg.date >= DATE(${startDate}) AND kg.date <= DATE(${endDate})) as knockouts,
            COUNT(*) as gamesPlayed,
            AVG(a.player_score) as avgScore,
            p.nickname
          FROM appearances a
          JOIN games g ON g.id = a.game_id
          JOIN venues v ON v.id = g.venue_id
          JOIN players_v2 p ON p.id = a.player_id
          WHERE v.name = ${venue.name}
          AND ${dateCondition}
          GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname
          ORDER BY totalPoints DESC, avgScore DESC
          LIMIT 5
        `;

        return {
          ...venue,
          topPlayers: serializeResults(topPlayers),
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
