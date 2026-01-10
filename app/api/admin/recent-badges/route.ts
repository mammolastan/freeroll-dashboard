// app/api/admin/recent-badges/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

export const dynamic = "force-dynamic"; // This ensures the route always runs dynamically

export async function GET() {
  try {
    const recentBadges = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT 
        pb.id,
        pb.player_uid,
        pb.earned_at,
        pb.description as badge_description,
        p.name,
        p.nickname,
        b.short_description,
        b.icon,
        b.rarity
      FROM player_badges pb
      LEFT JOIN players p ON pb.player_uid = p.uid
      LEFT JOIN badges b ON pb.badge_id = b.badge_id
      ORDER BY pb.earned_at DESC
      LIMIT 25
    `;

    // Convert BigInt values to numbers for JSON serialization
    const serializedBadges = (recentBadges).map((badge) => ({
      ...badge,
      id: Number(badge.id),
      earned_at:
        badge.earned_at instanceof Date
          ? badge.earned_at.toISOString()
          : badge.earned_at,
      rarity: Number(badge.rarity),
    }));

    return NextResponse.json(serializedBadges);
  } catch (error) {
    console.error("Error fetching recent badges:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent badges" },
      { status: 500 }
    );
  }
}
