// app/api/players/[uid]/badges/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { uid: string } }
) {
  try {
    const playerUID = params.uid;

    // Fetch badges for the specified player
    const playerBadges = await prisma.$queryRaw`
      SELECT 
        pb.id,
        b.name,
        b.short_description,
        b.long_description,
        b.icon,
        b.rarity,
        pb.earned_at
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.badge_id
      WHERE pb.player_uid = ${playerUID}
      ORDER BY pb.earned_at DESC
    `;

    return NextResponse.json(playerBadges);
  } catch (error) {
    console.error("Player badges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch player badges" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
