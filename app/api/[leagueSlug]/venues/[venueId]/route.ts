// app/api/[leagueSlug]/venues/[venueId]/route.ts
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

// PUT /api/[leagueSlug]/venues/[venueId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string; venueId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug, venueId } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt(venueId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid venue ID" }, { status: 400 });
  }

  // Verify venue belongs to this league
  const existing = await prisma.venues.findFirst({
    where: { id, league_id: leagueId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, address, notes, isActive, latitude, longitude, checkinRadiusMeters } = body;

  try {
    const venue = await prisma.venues.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(isActive !== undefined && { is_active: Boolean(isActive) }),
        ...(latitude !== undefined && {
          latitude: latitude !== null && latitude !== "" ? latitude : null,
        }),
        ...(longitude !== undefined && {
          longitude: longitude !== null && longitude !== "" ? longitude : null,
        }),
        ...(checkinRadiusMeters !== undefined &&
          checkinRadiusMeters !== null &&
          checkinRadiusMeters !== "" && {
            checkin_radius_meters: parseInt(checkinRadiusMeters),
          }),
      },
    });

    return NextResponse.json({
      venue: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        notes: venue.notes,
        isActive: venue.is_active,
        latitude: venue.latitude !== null ? Number(venue.latitude) : null,
        longitude: venue.longitude !== null ? Number(venue.longitude) : null,
        checkinRadiusMeters: venue.checkin_radius_meters,
      },
    });
  } catch (error) {
    console.error("Error updating venue:", error);
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      return NextResponse.json(
        { error: "A venue with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update venue" },
      { status: 500 }
    );
  }
}

// DELETE /api/[leagueSlug]/venues/[venueId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leagueSlug: string; venueId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug, venueId } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt(venueId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid venue ID" }, { status: 400 });
  }

  // Verify venue belongs to this league
  const existing = await prisma.venues.findFirst({
    where: { id, league_id: leagueId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  // Safety: check if any games reference this venue
  const gameCount = await prisma.games.count({ where: { venue_id: id } });
  if (gameCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${gameCount} game(s) use this venue. Mark it inactive instead.`,
      },
      { status: 409 }
    );
  }

  // Also check tournament_drafts
  const draftCount = await prisma.tournamentDraft.count({
    where: { venue_id: id },
  });
  if (draftCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${draftCount} tournament draft(s) use this venue. Mark it inactive instead.`,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.venues.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting venue:", error);
    return NextResponse.json(
      { error: "Failed to delete venue" },
      { status: 500 }
    );
  }
}
