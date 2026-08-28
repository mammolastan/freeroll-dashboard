// app/api/venues/[venue]/stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { Prisma } from "@prisma/client";
import { getLeagueConfig } from "@/lib/league-config";
import { getLeagueNow, getLeagueMonthRange, formatLeagueDate } from "@/lib/league-time";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ venue: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const { venue: venueParam } = await params;
    const venue = decodeURIComponent(venueParam);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    // Get the venue to find its league
    const venueRecord = await prisma.venues.findFirst({
      where: { name: venue },
      select: { league_id: true },
    });

    // Get league config for timezone (default to ET if venue not found)
    const leagueId = venueRecord?.league_id ?? 1;
    const config = await getLeagueConfig(leagueId);
    const timezone = config.timezone;

    // Get current date in league timezone
    let baseDate = getLeagueNow(timezone);

    // Adjust for previous month if needed
    if (!isCurrentMonth) {
      baseDate.setMonth(baseDate.getMonth() - 1);
    }

    // Get date range for the month
    const { startOfMonth: startDate, endOfMonth: endDate } = getLeagueMonthRange(timezone, baseDate);

    // Get month name and year
    const monthName = formatLeagueDate(baseDate.toISOString(), timezone, 'monthYear').split(' ')[0];
    const year = baseDate.getFullYear();

    const dateCondition = Prisma.sql`g.date >= DATE(${startDate}) AND g.date <= DATE(${endDate})`;

    // Get top players for the venue
    const topPlayers = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as Name,
        p.uid as UID,
        p.nickname,
        COUNT(*) as gamesPlayed,
        SUM(a.points + COALESCE(g.bonus_points, 0)) as totalPoints,
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
        AVG(a.points + COALESCE(g.bonus_points, 0)) as avgPoints,
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
