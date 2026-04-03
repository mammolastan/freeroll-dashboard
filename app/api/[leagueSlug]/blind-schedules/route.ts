// app/api/[leagueSlug]/blind-schedules/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

// GET — list schedules available to this league
// Open to any authenticated user (TDs need this for the tournament dropdown)
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { leagueSlug } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leagueId = await getLeagueIdBySlug(leagueSlug);
    if (!leagueId) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const schedules = await prisma.$queryRaw<{
      id: number;
      league_id: number | null;
      name: string;
      description: string;
      levels: string;
      is_active: number;
      created_by: string | null;
      created_at: Date;
      updated_at: Date;
    }[]>`
      SELECT id, league_id, name, description, levels, is_active, created_by, created_at, updated_at
      FROM blind_schedules
      WHERE is_active = 1
        AND (league_id IS NULL OR league_id = ${leagueId})
      ORDER BY league_id IS NULL DESC, name ASC
    `;

    // Parse levels JSON for each row
    const result = schedules.map((s) => ({
      ...s,
      id: Number(s.id),
      is_active: Boolean(s.is_active),
      isSystem: s.league_id === null,
      levels: JSON.parse(s.levels),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[blind-schedules GET]", error);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

// POST — create a new league schedule (admin/owner only)
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { leagueSlug } = await params;
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

    const body = await req.json();
    const { name, description, levels } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!Array.isArray(levels) || levels.length === 0) {
      return NextResponse.json({ error: "Levels array is required" }, { status: 400 });
    }

    const levelsJson = JSON.stringify(levels);

    await prisma.$queryRaw`
      INSERT INTO blind_schedules (league_id, name, description, levels, is_active, created_by)
      VALUES (${leagueId}, ${name.trim()}, ${(description ?? "").trim()}, ${levelsJson}, 1, ${session.user.uid})
    `;

    const inserted = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM blind_schedules
      WHERE league_id = ${leagueId} AND created_by = ${session.user.uid}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return NextResponse.json({ id: Number(inserted[0].id) }, { status: 201 });
  } catch (error) {
    console.error("[blind-schedules POST]", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}
