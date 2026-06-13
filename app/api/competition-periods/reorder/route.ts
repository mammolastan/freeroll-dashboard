// app/api/competition-periods/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

// POST - Batch update display_order for multiple periods
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { updates } = body;

    // Validate input
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Updates must be a non-empty array of {id, display_order}" },
        { status: 400 }
      );
    }

    // Validate each update has required fields
    for (const update of updates) {
      if (typeof update.id !== "number" || typeof update.display_order !== "number") {
        return NextResponse.json(
          { error: "Each update must have numeric id and display_order" },
          { status: 400 }
        );
      }
    }

    // Fetch all periods being updated to verify league access
    const periodIds = updates.map((u: { id: number }) => u.id);
    const periods = await prisma.competition_periods.findMany({
      where: { id: { in: periodIds } },
      select: { id: true, league_id: true },
    });

    if (periods.length !== periodIds.length) {
      return NextResponse.json(
        { error: "One or more competition periods not found" },
        { status: 404 }
      );
    }

    // Verify all periods belong to the same league
    const leagueIds = [...new Set(periods.map((p) => p.league_id))];
    if (leagueIds.length !== 1) {
      return NextResponse.json(
        { error: "All periods must belong to the same league" },
        { status: 400 }
      );
    }

    const role = await getLeagueRole(session.user.uid, leagueIds[0]);
    if (!canAccessAdmin(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Perform batch update using a transaction
    await prisma.$transaction(
      updates.map((update: { id: number; display_order: number }) =>
        prisma.competition_periods.update({
          where: { id: update.id },
          data: {
            display_order: update.display_order,
            modified: new Date(),
          },
        })
      )
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error("Error reordering competition periods:", error);
    return NextResponse.json(
      { error: "Failed to reorder competition periods" },
      { status: 500 }
    );
  }
}
