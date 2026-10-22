// app/api/venues/names/route.ts
// Returns a simple list of venue names for the league (for dropdown filters)
// Optionally filters to venues that had games within a date range
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLeagueIdFromRequest } from "@/lib/league-utils";

// Cache for 6 hours - venue list rarely changes
export const revalidate = 21600;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = await getLeagueIdFromRequest(request);

    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    // If forPeriod=true, get venues that had games in the period (not just active venues)
    const forPeriod = searchParams.get("forPeriod") === "true";

    if (forPeriod) {
      // Get venues that had games during the specified period (or all time if no dates)
      const startDate = startDateParam && startDateParam !== "null"
        ? new Date(startDateParam)
        : null;
      const endDate = endDateParam && endDateParam !== "null"
        ? new Date(endDateParam)
        : null;

      // Build date conditions
      const dateConditions: Prisma.Sql[] = [];
      if (startDate) {
        dateConditions.push(Prisma.sql`g.date >= DATE(${startDate})`);
      }
      if (endDate) {
        dateConditions.push(Prisma.sql`g.date <= DATE(${endDate})`);
      }
      const dateCondition = dateConditions.length > 0
        ? Prisma.sql`AND ${Prisma.join(dateConditions, ' AND ')}`
        : Prisma.sql``;

      const venues = await prisma.$queryRaw<{ name: string }[]>`
        SELECT DISTINCT v.name
        FROM venues v
        JOIN games g ON g.venue_id = v.id
        WHERE v.league_id = ${leagueId}
        AND v.name != 'bonus'
        ${dateCondition}
        ORDER BY v.name ASC
      `;

      return NextResponse.json({
        venues: venues.map(v => v.name),
      });
    }

    // Default: return currently active venues
    const venues = await prisma.venues.findMany({
      where: {
        league_id: leagueId,
        name: { not: 'bonus' },
        is_active: true,
      },
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      venues: venues.map(v => v.name),
    });
  } catch (error) {
    console.error("Venue names error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue names" },
      { status: 500 }
    );
  }
}
