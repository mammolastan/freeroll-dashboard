// app/api/[leagueSlug]/badges/assign/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

// POST - Assign a badge to a player
export async function POST(req: NextRequest, { params }: RouteContext) {
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
    const body = await req.json();
    const { badgeId, playerUid, description, earnedAt } = body;

    if (!badgeId || !playerUid) {
      return NextResponse.json(
        { error: "badgeId and playerUid are required" },
        { status: 400 }
      );
    }

    // Verify the badge exists and is available for this league
    const badge = await prisma.badge.findUnique({
      where: { badge_id: badgeId },
    });

    if (!badge) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    if (badge.league !== 0 && badge.league !== leagueId) {
      return NextResponse.json(
        { error: "Badge not available for this league" },
        { status: 403 }
      );
    }

    // Verify the player exists and belongs to this league
    const player = await prisma.players_v2.findUnique({
      where: { uid: playerUid },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (player.league_id !== leagueId) {
      return NextResponse.json(
        { error: "Player does not belong to this league" },
        { status: 403 }
      );
    }

    // Parse the earned_at date or use current time
    const earnedAtDate = earnedAt ? new Date(earnedAt) : new Date();

    // Check if player already has this badge (non-expired)
    const existingBadge = await prisma.playerBadge.findFirst({
      where: {
        player_uid: playerUid,
        badge_id: badgeId,
        OR: [
          { expiration: null },
          { expiration: { gte: new Date() } },
        ],
      },
    });

    if (existingBadge) {
      return NextResponse.json(
        { error: "Player already has this badge" },
        { status: 409 }
      );
    }

    // Create the player badge
    const playerBadge = await prisma.playerBadge.create({
      data: {
        player_uid: playerUid,
        badge_id: badgeId,
        earned_at: earnedAtDate,
        description: description || null,
      },
    });

    return NextResponse.json(
      { success: true, playerBadge },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error assigning badge:", error);
    return NextResponse.json(
      { error: "Failed to assign badge" },
      { status: 500 }
    );
  }
}
