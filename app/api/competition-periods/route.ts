// app/api/competition-periods/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdFromRequest } from "@/lib/league-utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

export const revalidate = 3600; // 1 hour cache

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Use the league utility to resolve league_id from session, slug, or direct param
    const leagueIdNum = await getLeagueIdFromRequest(request);
    const periodType = searchParams.get("period_type");
    const activeOnly = searchParams.get("active_only") !== "false"; // defaults to true
    const playerUid = searchParams.get("playerUid"); // Optional: filter to periods where player has games

    // Build the query
    const whereClause: {
      league_id: number;
      period_type?: string;
      is_active?: boolean;
    } = {
      league_id: leagueIdNum,
    };

    if (periodType) {
      whereClause.period_type = periodType;
    }

    if (activeOnly) {
      whereClause.is_active = true;
    }

    let periods = await prisma.competition_periods.findMany({
      where: whereClause,
      orderBy: {
        display_order: "desc", // Newest first for UI dropdowns
      },
      select: {
        id: true,
        name: true,
        period_type: true,
        start_date: true,
        end_date: true,
        is_active: true,
        display_order: true,
      },
    });

    // If playerUid is provided, filter to only periods where the player has games
    if (playerUid) {
      // Get dates of all games the player participated in
      const playerGames = await prisma.$queryRaw<{ game_date: Date }[]>`
        SELECT DISTINCT g.date as game_date
        FROM appearances a
        JOIN games g ON g.id = a.game_id
        JOIN players_v2 p ON p.id = a.player_id
        WHERE p.uid = ${playerUid}
        AND g.league_id = ${leagueIdNum}
      `;

      const gameDates = playerGames.map(g => g.game_date);

      // Filter periods to only those that contain at least one of the player's game dates
      periods = periods.filter(period => {
        const periodStart = new Date(period.start_date);
        const periodEnd = new Date(period.end_date);
        return gameDates.some(gameDate => {
          const gd = new Date(gameDate);
          return gd >= periodStart && gd <= periodEnd;
        });
      });
    }

    return NextResponse.json({
      periods,
      league_id: leagueIdNum,
      count: periods.length,
    });
  } catch (error) {
    console.error("Competition periods error:", error);
    return NextResponse.json(
      { error: "Failed to fetch competition periods" },
      { status: 500 }
    );
  }
}

// POST - Create a new competition period
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const leagueIdNum = await getLeagueIdFromRequest(request);

    const role = await getLeagueRole(session.user.uid, leagueIdNum);
    if (!canAccessAdmin(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, period_type, start_date, end_date, is_active = true } = body;

    // Validate required fields (league comes from session / request, not trusted client body)
    if (!name || !period_type || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Missing required fields: name, period_type, start_date, end_date" },
        { status: 400 }
      );
    }

    // Calculate display_order based on start_date (newer periods get higher order)
    const startDateObj = new Date(start_date);
    const displayOrder = startDateObj.getFullYear() * 100 + (startDateObj.getMonth() + 1);

    // Create the new period
    const newPeriod = await prisma.competition_periods.create({
      data: {
        league_id: leagueIdNum,
        name,
        period_type,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        is_active: is_active === true || is_active === "true",
        display_order: displayOrder,
      },
      select: {
        id: true,
        name: true,
        period_type: true,
        start_date: true,
        end_date: true,
        is_active: true,
        display_order: true,
      },
    });

    return NextResponse.json(newPeriod, { status: 201 });
  } catch (error) {
    console.error("Error creating competition period:", error);
    return NextResponse.json(
      { error: "Failed to create competition period" },
      { status: 500 }
    );
  }
}
