import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole, canManageRoles } from "@/lib/league-auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ leagueSlug: string; roleId: string }>;
}

// DELETE - Remove an admin/owner
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { leagueSlug, roleId } = await params;
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

  const roleIdNum = parseInt(roleId, 10);
  if (isNaN(roleIdNum)) {
    return NextResponse.json({ error: "Invalid role ID" }, { status: 400 });
  }

  // Find the role to delete
  const roleToDelete = await prisma.league_roles.findUnique({
    where: { id: roleIdNum },
  });

  if (!roleToDelete || roleToDelete.league_id !== leagueId) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // Prevent deleting the last owner
  if (roleToDelete.role === "owner") {
    const ownerCount = await prisma.league_roles.count({
      where: { league_id: leagueId, role: "owner" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last owner" },
        { status: 400 }
      );
    }
  }

  await prisma.league_roles.delete({
    where: { id: roleIdNum },
  });

  return NextResponse.json({ success: true });
}

// PATCH - Update role (change between admin/owner)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { leagueSlug, roleId } = await params;
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

  const roleIdNum = parseInt(roleId, 10);
  if (isNaN(roleIdNum)) {
    return NextResponse.json({ error: "Invalid role ID" }, { status: 400 });
  }

  const body = await req.json();
  const { role: newRole } = body;

  if (newRole !== "owner" && newRole !== "admin") {
    return NextResponse.json(
      { error: "Role must be 'owner' or 'admin'" },
      { status: 400 }
    );
  }

  // Find the role to update
  const existingRole = await prisma.league_roles.findUnique({
    where: { id: roleIdNum },
  });

  if (!existingRole || existingRole.league_id !== leagueId) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // Prevent demoting the last owner
  if (existingRole.role === "owner" && newRole === "admin") {
    const ownerCount = await prisma.league_roles.count({
      where: { league_id: leagueId, role: "owner" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot demote the last owner" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.league_roles.update({
    where: { id: roleIdNum },
    data: { role: newRole, modified: new Date() },
  });

  return NextResponse.json({ success: true, role: updated });
}
