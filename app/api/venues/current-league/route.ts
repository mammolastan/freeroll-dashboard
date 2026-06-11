// GET /api/venues/current-league?activeOnly=true
// Venues for the signed-in admin's league (session.user.leagueId).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = session.user.leagueId;
  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";

  type VenueRow = {
    id: number;
    name: string;
    address: string | null;
    is_active: boolean;
    cutoff_time: number | null;
    game_count: bigint;
    last_game_date: Date | null;
  };

  const activeFilter = activeOnly
    ? Prisma.sql`AND v.is_active = true`
    : Prisma.empty;

  const venues = await prisma.$queryRaw<VenueRow[]>`
    SELECT
      v.id,
      v.name,
      v.address,
      v.is_active,
      v.cutoff_time,
      COUNT(g.id) as game_count,
      MAX(g.date) as last_game_date
    FROM venues v
    LEFT JOIN games g ON g.venue_id = v.id
    WHERE v.league_id = ${leagueId}
    ${activeFilter}
    GROUP BY v.id
    ORDER BY 
      (MAX(g.date) IS NULL) ASC,
      MAX(g.date) DESC,
      v.name ASC
  `;

  const mappedVenues = venues.map((v) => ({
    id: v.id,
    name: v.name,
    address: v.address,
    isActive: v.is_active,
    cutoffTime: v.cutoff_time,
    gameCount: Number(v.game_count),
    lastGameDate: v.last_game_date
      ? v.last_game_date.toISOString().split("T")[0]
      : null,
  }));

  return NextResponse.json({ venues: mappedVenues });
}
