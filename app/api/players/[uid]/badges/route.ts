// app/api/players/[uid]/badges/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const playerUID = uid;

    // Fetch badges for the specified player, filtering out expired ones
    const playerBadges = await prisma.$queryRaw`
      SELECT 
        pb.id,
        b.quote,
        b.criteria,
        b.short_description,
        b.long_description,
        b.icon,
        b.rarity,
        pb.earned_at,
        pb.expiration,
        pb.description
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.badge_id
      WHERE pb.player_uid = ${playerUID}
        AND (pb.expiration IS NULL OR pb.expiration >= CURDATE())
      ORDER BY pb.earned_at DESC
    `;

    return NextResponse.json(playerBadges);
  } catch (error) {
    console.error("Player badges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch player badges" },
      { status: 500 }
    );
  }
}
