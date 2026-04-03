// app/api/[leagueSlug]/blind-schedules/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

interface RouteContext {
  params: Promise<{ leagueSlug: string; id: string }>;
}

// PATCH — update name, description, and/or levels (admin/owner only)
// System schedules (league_id IS NULL) cannot be edited via this route.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { leagueSlug, id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leagueId = await getLeagueIdBySlug(leagueSlug);
    if (!leagueId) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const role = await getLeagueRole(session.user.uid, leagueId);
    if (!canAccessAdmin(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the schedule belongs to this league (not a system schedule)
    const existing = await prisma.$queryRaw<{ id: number; league_id: number | null }[]>`
      SELECT id, league_id FROM blind_schedules
      WHERE id = ${scheduleId} AND is_active = 1
      LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    if (existing[0].league_id === null) {
      return NextResponse.json({ error: "System schedules cannot be edited" }, { status: 403 });
    }
    if (Number(existing[0].league_id) !== leagueId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, levels } = body;

    const nameVal = name?.trim() ?? null;
    const descVal = description?.trim() ?? null;
    const levelsVal = levels ? JSON.stringify(levels) : null;

    if (nameVal !== null && nameVal.length === 0) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }

    await prisma.$queryRaw`
      UPDATE blind_schedules
      SET
        name        = COALESCE(${nameVal}, name),
        description = COALESCE(${descVal}, description),
        levels      = COALESCE(${levelsVal}, levels),
        updated_at  = CURRENT_TIMESTAMP
      WHERE id = ${scheduleId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[blind-schedules PATCH]", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

// DELETE — soft delete (admin/owner only, league schedules only)
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { leagueSlug, id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leagueId = await getLeagueIdBySlug(leagueSlug);
    if (!leagueId) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const role = await getLeagueRole(session.user.uid, leagueId);
    if (!canAccessAdmin(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify ownership — system schedules cannot be deleted
    const existing = await prisma.$queryRaw<{ id: number; league_id: number | null }[]>`
      SELECT id, league_id FROM blind_schedules
      WHERE id = ${scheduleId} AND is_active = 1
      LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    if (existing[0].league_id === null) {
      return NextResponse.json({ error: "System schedules cannot be deleted" }, { status: 403 });
    }
    if (Number(existing[0].league_id) !== leagueId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$queryRaw`
      UPDATE blind_schedules SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${scheduleId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[blind-schedules DELETE]", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}
