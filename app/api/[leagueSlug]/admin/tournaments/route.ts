// app/api/[leagueSlug]/admin/tournaments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

// GET - Fetch recent games or games around a date
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

  const searchDate = req.nextUrl.searchParams.get("date");

  let games;

  if (searchDate) {
    // Search for games within ±5 days of the given date
    const centerDate = new Date(searchDate);
    const startDate = new Date(centerDate);
    startDate.setDate(startDate.getDate() - 5);
    const endDate = new Date(centerDate);
    endDate.setDate(endDate.getDate() + 5);

    games = await prisma.games.findMany({
      where: {
        league_id: leagueId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
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
      orderBy: { date: "desc" },
    });
  } else {
    // Get 20 most recent games
    games = await prisma.games.findMany({
      where: { league_id: leagueId },
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
      orderBy: { date: "desc" },
      take: 20,
    });
  }

  const formattedGames = games.map((game) => ({
    id: game.id,
    uid: game.uid,
    date: game.date.toISOString().split("T")[0],
    time: game.time,
    director: game.director,
    bonusPoints: game.bonus_points,
    venue: {
      id: game.venues.id,
      name: game.venues.name,
    },
    periods: game.game_periods.map((gp) => ({
      id: gp.competition_periods.id,
      name: gp.competition_periods.name,
      periodType: gp.competition_periods.period_type,
    })),
    playerCount: game._count.appearances,
  }));

  return NextResponse.json({ games: formattedGames });
}
