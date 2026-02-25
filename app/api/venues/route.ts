// app/api/venues/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get venues from the venues table that have recent games (past year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const venues = await prisma.$queryRaw<{ venue: string }[]>`
      SELECT v.name as venue
      FROM venues v
      JOIN games g ON g.venue_id = v.id
      WHERE v.name IS NOT NULL
      AND v.name != ''
      AND g.date >= ${oneYearAgo.toISOString().split("T")[0]}
      GROUP BY v.id, v.name
      ORDER BY MAX(g.date) DESC
    `;

    // Extract just the venue names
    const venueNames = venues.map((v) => v.venue).filter(Boolean);

    return NextResponse.json(venueNames);
  } catch (error) {
    console.error("Error fetching venues:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}
