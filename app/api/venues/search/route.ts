// app/api/venues/search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
export const dynamic = "force-dynamic";

function serializeResults(results: RawQueryResult[]): RawQueryResult[] {
  return results.map((record) => {
    const serialized = { ...record };
    for (const key in serialized) {
      if (typeof serialized[key] === "bigint") {
        serialized[key] = serialized[key].toString();
      }
    }
    return serialized;
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json([]);
    }

    const venues = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        v.name,
        COUNT(DISTINCT g.id) as totalGames
      FROM venues v
      LEFT JOIN games g ON g.venue_id = v.id
      WHERE v.name LIKE ${`%${query}%`}
      GROUP BY v.id, v.name
      ORDER BY totalGames DESC
      LIMIT 10
    `;

    const serializedVenues = serializeResults(venues);
    return NextResponse.json(serializedVenues);
  } catch (error) {
    console.error("Venue search error:", error);
    return NextResponse.json(
      { error: "Failed to search venues" },
      { status: 500 }
    );
  }
}
