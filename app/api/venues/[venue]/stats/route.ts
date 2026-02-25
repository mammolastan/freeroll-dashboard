// app/api/venues/[venue]/stats/route.ts
import { NextResponse } from "next/server";
import { getCurrentETDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { Prisma } from "@prisma/client";

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

// Helper function to create dates in ET
function createDateFromET(
  year: number,
  month: number,
  day = 1,
  hour = 0
): Date {
  const date = new Date(Date.UTC(year, month, day, hour));
  return new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

function getDateRangeForMonth(date: Date): {
  startDate: Date;
  endDate: Date;
  monthName: string;
  year: number;
} {
  // Get ET date components
  const etDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const etYear = etDate.getFullYear();
  const etMonth = etDate.getMonth();

  // Create start and end dates
  const startDate = createDateFromET(etYear, etMonth);
  const endDate = createDateFromET(etYear, etMonth + 1, 0, 23);
  endDate.setUTCMinutes(59);
  endDate.setUTCSeconds(59);
  endDate.setUTCMilliseconds(999);

  // Get the month name directly from the ET date
  const monthName = etDate.toLocaleString("en-US", {
    month: "long",
    timeZone: "America/New_York",
  });

  return { startDate, endDate, monthName, year: etYear };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ venue: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const { venue: venueParam } = await params;
    const venue = decodeURIComponent(venueParam);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    // Get current date
    let baseDate = getCurrentETDate();

    // Adjust for previous month if needed
    if (!isCurrentMonth) {
      const etDate = new Date(
        baseDate.toLocaleString("en-US", { timeZone: "America/New_York" })
      );
      etDate.setMonth(etDate.getMonth() - 1);
      baseDate = etDate;
    }

    // Get date range and details
    const { startDate, endDate, monthName, year } =
      getDateRangeForMonth(baseDate);

    const dateCondition = Prisma.sql`g.date >= DATE(${startDate}) AND g.date <= DATE(${endDate})`;

    // Get top players for the venue
    const topPlayers = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as Name,
        p.uid as UID,
        p.nickname,
        COUNT(*) as gamesPlayed,
        SUM(a.points) as totalPoints,
        (SELECT COUNT(*) FROM knockouts k
         JOIN games kg ON kg.id = k.game_id
         JOIN venues kv ON kv.id = kg.venue_id
         WHERE k.hitman = p.id
         AND kv.name = ${venue}
         AND ${dateCondition}) as knockouts,
        AVG(a.player_score) as avgScore
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE v.name = ${venue}
      AND ${dateCondition}
      GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname
      HAVING gamesPlayed > 0
      ORDER BY totalPoints DESC, avgScore DESC
      LIMIT 25
    `;

    // Get venue statistics
    const venueStats = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        COUNT(DISTINCT g.id) as totalGames,
        COUNT(DISTINCT a.player_id) as uniquePlayers,
        AVG(a.points) as avgPoints,
        (SELECT COUNT(*) FROM knockouts k
         JOIN games kg ON kg.id = k.game_id
         JOIN venues kv ON kv.id = kg.venue_id
         WHERE kv.name = ${venue}
         AND kg.date >= DATE(${startDate}) AND kg.date <= DATE(${endDate})) as totalKnockouts
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      WHERE v.name = ${venue}
      AND ${dateCondition}
    `;

    const response = {
      topPlayers: serializeResults(topPlayers),
      stats: serializeResults(venueStats)[0],
      month: monthName,
      year,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Venue stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue stats" },
      { status: 500 }
    );
  }
}
