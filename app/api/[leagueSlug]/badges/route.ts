// app/api/[leagueSlug]/badges/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

// GET badges available for this league with player counts
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { leagueSlug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const userRole = await getLeagueRole(session.user.uid, leagueId);
  if (userRole !== "owner" && userRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Fetch badges where league is 0 (global) OR matches this league
    // For now, we only show global badges (league = 0), but the logic supports league-specific
    const badges = await prisma.badge.findMany({
      where: {
        OR: [
          { league: 0 },
          { league: leagueId },
        ],
        enabled: true,
      },
      orderBy: [
        { rarity: "desc" },
        { short_description: "asc" },
      ],
    });

    // Get player counts for each badge within this league
    // We need to join player_badges with players_v2 to filter by league
    const badgeCounts = await prisma.$queryRaw<{ badge_id: string; count: bigint }[]>`
      SELECT
        pb.badge_id,
        COUNT(DISTINCT pb.player_uid) as count
      FROM player_badges pb
      INNER JOIN players_v2 p ON pb.player_uid = p.uid
      WHERE p.league_id = ${leagueId}
        AND (pb.expiration IS NULL OR pb.expiration >= NOW())
      GROUP BY pb.badge_id
    `;

    // Create a map of badge_id to count
    const countMap = new Map<string, number>();
    for (const bc of badgeCounts) {
      countMap.set(bc.badge_id, Number(bc.count));
    }

    // Transform badges with counts
    const badgesWithCounts = badges.map((badge) => ({
      badge_id: badge.badge_id,
      short_description: badge.short_description,
      long_description: badge.long_description,
      quote: badge.quote,
      criteria: badge.criteria,
      category: badge.category,
      rarity: badge.rarity,
      icon: badge.icon || "default.svg",
      tier: badge.tier,
      league: badge.league,
      playerCount: countMap.get(badge.badge_id) || 0,
    }));

    return NextResponse.json({ badges: badgesWithCounts });
  } catch (error) {
    console.error("Error fetching badges:", error);
    return NextResponse.json(
      { error: "Failed to fetch badges" },
      { status: 500 }
    );
  }
}
