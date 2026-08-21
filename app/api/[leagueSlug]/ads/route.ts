import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

/**
 * Public endpoint to get active ads for a league.
 * Used by the TV screen to display rotating ads in the Featured section.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { leagueSlug } = await params;
    const leagueId = await getLeagueIdBySlug(leagueSlug);

    if (!leagueId) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const ads = await prisma.leagueAd.findMany({
      where: {
        league_id: leagueId,
        is_active: true,
      },
      orderBy: {
        display_order: "asc",
      },
      select: {
        id: true,
        image_url: true,
        title: true,
        link_url: true,
        display_order: true,
      },
    });

    return NextResponse.json({ ads });
  } catch (error) {
    console.error("Error fetching league ads:", error);
    return NextResponse.json(
      { error: "Failed to fetch ads" },
      { status: 500 }
    );
  }
}
