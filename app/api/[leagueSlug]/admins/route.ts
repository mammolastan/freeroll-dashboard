import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole, canManageRoles } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

// GET all admins/owners for this league
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

  const roles = await prisma.league_roles.findMany({
    where: { league_id: leagueId },
    orderBy: [{ role: "asc" }, { created: "asc" }],
  });

  // Get player info for each role
  const playerUids = roles.map((r) => r.player_uid);
  const players = await prisma.players_v2.findMany({
    where: { uid: { in: playerUids } },
    select: { uid: true, first_name: true, last_name: true, nickname: true },
  });

  const playerMap = new Map(players.map((p) => [p.uid, p]));

  const admins = roles.map((r) => {
    const player = playerMap.get(r.player_uid);
    return {
      id: r.id,
      playerUid: r.player_uid,
      role: r.role,
      assignedBy: r.assigned_by,
      created: r.created,
      firstName: player?.first_name ?? null,
      lastName: player?.last_name ?? null,
      nickname: player?.nickname ?? null,
    };
  });

  return NextResponse.json({ admins });
}

// POST - Add a new admin/owner (owner-only)
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
  if (!canManageRoles(userRole)) {
    return NextResponse.json(
      { error: "Only owners can manage roles" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { playerUid, role } = body;

  if (!playerUid || !role) {
    return NextResponse.json(
      { error: "playerUid and role are required" },
      { status: 400 }
    );
  }

  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { error: "Role must be 'owner' or 'admin'" },
      { status: 400 }
    );
  }

  // Check if player exists
  const player = await prisma.players_v2.findUnique({
    where: { uid: playerUid },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Check if role already exists
  const existing = await prisma.league_roles.findUnique({
    where: { unique_member: { league_id: leagueId, player_uid: playerUid } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Player already has a role in this league" },
      { status: 409 }
    );
  }

  const newRole = await prisma.league_roles.create({
    data: {
      league_id: leagueId,
      player_uid: playerUid,
      role: role,
      assigned_by: session.user.uid,
    },
  });

  return NextResponse.json({ success: true, role: newRole }, { status: 201 });
}
