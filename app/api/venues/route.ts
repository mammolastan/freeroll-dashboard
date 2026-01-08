// app/api/venues/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get unique venues from poker_tournaments table within the past year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const venues = await prisma.$queryRaw<{ venue: string }[]>`
      SELECT Venue as venue
      FROM poker_tournaments
      WHERE Venue IS NOT NULL 
      AND Venue != ''
      AND game_date >= ${oneYearAgo.toISOString().split("T")[0]}
      GROUP BY Venue
      ORDER BY MAX(created_at) DESC
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
