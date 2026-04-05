// app/api/[leagueSlug]/venues/route.ts
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { NextRequest, NextResponse } from "next/server";

// GET /api/[leagueSlug]/venues
// GET /api/[leagueSlug]/venues?activeOnly=true
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string }> }
) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";

  // Use raw query to get venue stats efficiently
  type VenueRow = {
    id: number;
    name: string;
    address: string | null;
    notes: string | null;
    is_active: boolean;
    cutoff_time: number | null;
    game_count: bigint;
    last_game_date: Date | null;
  };

  let sql = `
  SELECT
    v.id,
    v.name,
    v.address,
    v.notes,
    v.is_active,
    v.cutoff_time,
    COUNT(g.id) as game_count,
    MAX(g.date) as last_game_date
  FROM venues v
  LEFT JOIN games g ON g.venue_id = v.id
  WHERE v.league_id = ${leagueId}
`;

  if (activeOnly) {
    sql += ` AND v.is_active = true`;
  }

  sql += `
  GROUP BY v.id
  ORDER BY 
    (MAX(g.date) IS NULL) ASC,
    MAX(g.date) DESC,
    v.name ASC
`;

  const venues = await prisma.$queryRawUnsafe<VenueRow[]>(sql);



  // Map to camelCase for frontend consistency
  const mappedVenues = venues.map((v) => ({
    id: v.id,
    name: v.name,
    address: v.address,
    notes: v.notes,
    isActive: v.is_active,
    cutoffTime: v.cutoff_time,
    gameCount: Number(v.game_count),
    lastGameDate: v.last_game_date
      ? v.last_game_date.toISOString().split("T")[0]
      : null,
  }));

  return NextResponse.json({ venues: mappedVenues });
}

// POST /api/[leagueSlug]/venues
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string }> }
) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, address, notes, isActive, cutoffTime } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const venue = await prisma.venues.create({
      data: {
        league_id: leagueId,
        name: name.trim(),
        address: address?.trim() || null,
        notes: notes || null,
        is_active: isActive !== undefined ? Boolean(isActive) : true,
        cutoff_time: cutoffTime ? parseInt(cutoffTime) : null,
      },
    });

    return NextResponse.json(
      {
        venue: {
          id: venue.id,
          name: venue.name,
          address: venue.address,
          notes: venue.notes,
          isActive: venue.is_active,
          cutoffTime: venue.cutoff_time,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating venue:", error);
    // Check for unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      return NextResponse.json(
        { error: "A venue with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create venue" },
      { status: 500 }
    );
  }
}
