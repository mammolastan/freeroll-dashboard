// app/api/competition-periods/types/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdFromRequest } from "@/lib/league-utils";

// GET - Get distinct period types for a league
export async function GET(request: Request) {
  try {
    const leagueId = await getLeagueIdFromRequest(request);

    // Get distinct period types from this league's periods
    const periods = await prisma.competition_periods.findMany({
      where: { league_id: leagueId },
      select: { period_type: true },
      distinct: ["period_type"],
    });

    const types = periods.map((p) => p.period_type);

    // Always include the defaults if not present
    const defaultTypes = ["season", "quarterly", "monthly"];
    const allTypes = [...new Set([...defaultTypes, ...types])];

    return NextResponse.json({ types: allTypes });
  } catch (error) {
    console.error("Error fetching period types:", error);
    return NextResponse.json(
      { error: "Failed to fetch period types" },
      { status: 500 }
    );
  }
}
