// app/api/competition-periods/types/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdFromRequest } from "@/lib/league-utils";

export const revalidate = 3600; // 1 hour cache

// GET - Get distinct active period types for a league
export async function GET(request: Request) {
  try {
    const leagueId = await getLeagueIdFromRequest(request);

    // Get distinct period types from this league's active periods
    const periods = await prisma.competition_periods.findMany({
      where: {
        league_id: leagueId,
        is_active: true,
      },
      select: { period_type: true },
      distinct: ["period_type"],
    });

    const types = periods.map((p) => p.period_type);

    return NextResponse.json({
      types,
      league_id: leagueId,
    });
  } catch (error) {
    console.error("Error fetching period types:", error);
    return NextResponse.json(
      { error: "Failed to fetch period types" },
      { status: 500 }
    );
  }
}
