// app/api/competition-periods/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueIdFromRequest } from "@/lib/league-utils";

export const revalidate = 3600; // 1 hour cache

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Use the league utility to resolve league_id from session, slug, or direct param
    const leagueIdNum = await getLeagueIdFromRequest(request);
    const periodType = searchParams.get("period_type");
    const activeOnly = searchParams.get("active_only") !== "false"; // defaults to true

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

    const periods = await prisma.competition_periods.findMany({
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
  try {
    const body = await request.json();
    const { league_id, name, period_type, start_date, end_date, is_active = true } = body;

    // Validate required fields
    if (!league_id || !name || !period_type || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Missing required fields: league_id, name, period_type, start_date, end_date" },
        { status: 400 }
      );
    }

    // Validate period_type
    if (!["monthly", "quarterly"].includes(period_type)) {
      return NextResponse.json(
        { error: "period_type must be 'monthly' or 'quarterly'" },
        { status: 400 }
      );
    }

    // Calculate display_order based on start_date (newer periods get higher order)
    const startDateObj = new Date(start_date);
    const displayOrder = startDateObj.getFullYear() * 100 + (startDateObj.getMonth() + 1);

    // Create the new period
    const newPeriod = await prisma.competition_periods.create({
      data: {
        league_id: parseInt(league_id),
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
