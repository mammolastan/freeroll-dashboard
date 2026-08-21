import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

interface RecentBadgeData {
  id: number;
  playerName: string;
  playerPhotoUrl: string | null;
  badgeName: string;
  badgeImageUrl: string;
  badgeRarity: string;
  earnedAt: string;
}

// Convert rarity number to string
function getRarityText(rarityNum: number): string {
  if (rarityNum >= 99) return "legendary";
  if (rarityNum >= 70) return "rare";
  if (rarityNum >= 33) return "uncommon";
  return "common";
}

/**
 * Public endpoint to get the 5 most recent badges awarded in the league.
 * Used by the "Recent Badges" featured module on the TV screen.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { leagueSlug } = await params;
    const leagueId = await getLeagueIdBySlug(leagueSlug);

    if (!leagueId) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    // Get the 50 most recent badges awarded to players in this league
    const recentBadges = await prisma.playerBadge.findMany({
      where: {
        player: {
          league_id: leagueId,
        },
      },
      orderBy: {
        earned_at: "desc",
      },
      take: 50,
      include: {
        player: {
          select: {
            first_name: true,
            last_name: true,
            nickname: true,
            photo_url: true,
          },
        },
        badge: {
          select: {
            short_description: true,
            icon: true,
            rarity: true,
          },
        },
      },
    });

    // Transform to the format needed by the module
    const badges: RecentBadgeData[] = recentBadges.map((pb) => {
      const playerName = pb.player.nickname
        || `${pb.player.first_name || ""} ${pb.player.last_name || ""}`.trim()
        || "Unknown Player";

      return {
        id: pb.id,
        playerName,
        playerPhotoUrl: pb.player.photo_url,
        badgeName: pb.badge.short_description,
        badgeImageUrl: `/images/badges/${pb.badge.icon || "default.svg"}`,
        badgeRarity: getRarityText(pb.badge.rarity),
        earnedAt: pb.earned_at.toISOString(),
      };
    });

    return NextResponse.json({ badges });
  } catch (error) {
    console.error("Error fetching recent badges:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent badges" },
      { status: 500 }
    );
  }
}
