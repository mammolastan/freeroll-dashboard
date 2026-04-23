// app/api/[leagueSlug]/admin/tournaments/[gameId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ leagueSlug: string; gameId: string }>;
}

// PATCH - Update a game
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { leagueSlug, gameId } = await params;
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

  const gameIdNum = parseInt(gameId, 10);
  if (isNaN(gameIdNum)) {
    return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  }

  // Verify game exists and belongs to this league
  const existingGame = await prisma.games.findFirst({
    where: { id: gameIdNum, league_id: leagueId },
  });

  if (!existingGame) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const body = await req.json();
  const { venueId, date, bonusPoints, periodIds } = body;

  // Build update data
  const updateData: {
    venue_id?: number;
    date?: Date;
    bonus_points?: number;
  } = {};

  if (venueId !== undefined) {
    // Verify venue exists and belongs to this league
    const venue = await prisma.venues.findFirst({
      where: { id: venueId, league_id: leagueId },
    });
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 400 });
    }
    updateData.venue_id = venueId;
  }

  if (date !== undefined) {
    updateData.date = new Date(date);
  }

  if (bonusPoints !== undefined) {
    const bp = parseInt(bonusPoints, 10);
    if (isNaN(bp)) {
      return NextResponse.json(
        { error: "Bonus points must be a number" },
        { status: 400 }
      );
    }
    updateData.bonus_points = bp;
  }

  // Update game in a transaction
  await prisma.$transaction(async (tx) => {
    // Update game fields
    if (Object.keys(updateData).length > 0) {
      await tx.games.update({
        where: { id: gameIdNum },
        data: updateData,
      });
    }

    // Update competition periods if provided
    if (periodIds !== undefined && Array.isArray(periodIds)) {
      // Verify all periods exist and belong to this league
      const validPeriods = await tx.competition_periods.findMany({
        where: {
          id: { in: periodIds },
          league_id: leagueId,
        },
        select: { id: true },
      });

      const validPeriodIds = validPeriods.map((p) => p.id);

      // Delete existing game_periods for this game
      await tx.game_periods.deleteMany({
        where: { game_id: gameIdNum },
      });

      // Create new game_periods
      if (validPeriodIds.length > 0) {
        await tx.game_periods.createMany({
          data: validPeriodIds.map((periodId) => ({
            game_id: gameIdNum,
            period_id: periodId,
            assigned_by: "admin",
          })),
        });
      }
    }
  });

  // Fetch updated game to return
  const updatedGame = await prisma.games.findUnique({
    where: { id: gameIdNum },
    include: {
      venues: { select: { id: true, name: true } },
      game_periods: {
        include: {
          competition_periods: {
            select: { id: true, name: true, period_type: true },
          },
        },
      },
      _count: { select: { appearances: true } },
    },
  });

  if (!updatedGame) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({
    game: {
      id: updatedGame.id,
      uid: updatedGame.uid,
      date: updatedGame.date.toISOString().split("T")[0],
      time: updatedGame.time,
      director: updatedGame.director,
      bonusPoints: updatedGame.bonus_points,
      venue: {
        id: updatedGame.venues.id,
        name: updatedGame.venues.name,
      },
      periods: updatedGame.game_periods.map((gp) => ({
        id: gp.competition_periods.id,
        name: gp.competition_periods.name,
        periodType: gp.competition_periods.period_type,
      })),
      playerCount: updatedGame._count.appearances,
    },
  });
}
