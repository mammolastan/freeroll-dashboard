// app/api/[leagueSlug]/admin/ads/[adId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

interface RouteParams {
  params: Promise<{ leagueSlug: string; adId: string }>;
}

// PUT /api/[leagueSlug]/admin/ads/[adId] - Update an ad
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug, adId } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt(adId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ad ID" }, { status: 400 });
  }

  // Verify ad belongs to this league
  const existing = await prisma.leagueAd.findFirst({
    where: { id, league_id: leagueId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  const body = await req.json();
  const { imageUrl, title, linkUrl, displayOrder, isActive } = body;

  try {
    const ad = await prisma.leagueAd.update({
      where: { id },
      data: {
        ...(imageUrl !== undefined && { image_url: imageUrl.trim() }),
        ...(title !== undefined && { title: title?.trim() || null }),
        ...(linkUrl !== undefined && { link_url: linkUrl?.trim() || null }),
        ...(displayOrder !== undefined && {
          display_order: parseInt(displayOrder),
        }),
        ...(isActive !== undefined && { is_active: Boolean(isActive) }),
      },
    });

    return NextResponse.json({
      ad: {
        id: ad.id,
        imageUrl: ad.image_url,
        title: ad.title,
        linkUrl: ad.link_url,
        displayOrder: ad.display_order,
        isActive: ad.is_active,
        createdAt: ad.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating ad:", error);
    return NextResponse.json({ error: "Failed to update ad" }, { status: 500 });
  }
}

// DELETE /api/[leagueSlug]/admin/ads/[adId] - Delete an ad
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug, adId } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt(adId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ad ID" }, { status: 400 });
  }

  // Verify ad belongs to this league
  const existing = await prisma.leagueAd.findFirst({
    where: { id, league_id: leagueId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  try {
    await prisma.leagueAd.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ad:", error);
    return NextResponse.json({ error: "Failed to delete ad" }, { status: 500 });
  }
}
