// app/api/venues/search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const dynamic = "force-dynamic";

function serializeResults(results: any[]) {
  return results.map((record) => {
    const serialized = { ...record };
    for (let key in serialized) {
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

    const venues = await prisma.$queryRaw`
      SELECT 
        Venue as name,
        COUNT(DISTINCT File_name) as totalGames
      FROM poker_tournaments
      WHERE Venue LIKE ${`%${query}%`}
      GROUP BY Venue
      ORDER BY totalGames DESC
      LIMIT 10
    `;

    const serializedVenues = serializeResults(venues as any[]);
    return NextResponse.json(serializedVenues);
  } catch (error) {
    console.error("Venue search error:", error);
    return NextResponse.json(
      { error: "Failed to search venues" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
