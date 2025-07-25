// app/api/players/badges/batch/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Set cache control
export const revalidate = 604800; // 7 days in seconds

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate the request body
    if (!body.uids || !Array.isArray(body.uids) || body.uids.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. Expected array of player UIDs." },
        { status: 400 }
      );
    }

    // Limit the number of UIDs to prevent abuse
    const playerUIDs = body.uids.slice(0, 400);

    // Fetch badges for all requested players in a single query, filtering out expired ones
    const batchBadges = await prisma.$queryRaw`
      SELECT 
        pb.player_uid,
        pb.id,
        b.name,
        b.short_description,
        b.long_description,
        b.icon,
        b.rarity,
        b.tier,
        pb.earned_at,
        pb.expiration,
        pb.description
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.badge_id
      WHERE pb.player_uid IN (${Prisma.join(playerUIDs)})
        AND (pb.expiration IS NULL OR pb.expiration >= CURDATE())
      ORDER BY pb.earned_at DESC
    `;

    // Group badges by player_uid
    const groupedBadges = (batchBadges as any[]).reduce((acc, badge) => {
      const playerUid = badge.player_uid;
      if (!acc[playerUid]) {
        acc[playerUid] = [];
      }

      // Remove player_uid from the badge object to keep the response clean
      const { player_uid, ...badgeData } = badge;
      acc[playerUid].push(badgeData);

      return acc;
    }, {});

    return NextResponse.json(groupedBadges);
  } catch (error) {
    console.error("Batch badges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch badges" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
