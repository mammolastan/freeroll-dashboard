// app/api/[leagueSlug]/admin/ads/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

// GET /api/[leagueSlug]/admin/ads - Get all ads for admin management
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ads = await prisma.leagueAd.findMany({
    where: { league_id: leagueId },
    orderBy: { display_order: "asc" },
  });

  const mappedAds = ads.map((ad) => ({
    id: ad.id,
    imageUrl: ad.image_url,
    title: ad.title,
    linkUrl: ad.link_url,
    displayOrder: ad.display_order,
    isActive: ad.is_active,
    createdAt: ad.created_at.toISOString(),
  }));

  return NextResponse.json({ ads: mappedAds });
}

// POST /api/[leagueSlug]/admin/ads - Create a new ad
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { imageUrl, title, linkUrl, isActive } = body;

  if (!imageUrl?.trim()) {
    return NextResponse.json(
      { error: "Image URL is required" },
      { status: 400 }
    );
  }

  // Get the highest display_order for this league
  const maxOrderResult = await prisma.leagueAd.aggregate({
    where: { league_id: leagueId },
    _max: { display_order: true },
  });
  const nextOrder = (maxOrderResult._max.display_order ?? -1) + 1;

  try {
    const ad = await prisma.leagueAd.create({
      data: {
        league_id: leagueId,
        image_url: imageUrl.trim(),
        title: title?.trim() || null,
        link_url: linkUrl?.trim() || null,
        display_order: nextOrder,
        is_active: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json(
      {
        ad: {
          id: ad.id,
          imageUrl: ad.image_url,
          title: ad.title,
          linkUrl: ad.link_url,
          displayOrder: ad.display_order,
          isActive: ad.is_active,
          createdAt: ad.created_at.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating ad:", error);
    return NextResponse.json({ error: "Failed to create ad" }, { status: 500 });
  }
}
