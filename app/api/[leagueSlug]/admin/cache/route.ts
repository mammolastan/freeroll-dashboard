// app/api/[leagueSlug]/admin/cache/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole } from "@/lib/league-auth";
import { revalidateRankingsCache } from "@/lib/rankings-cache";

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

// POST - Invalidate cache for this league
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

  // Only owners can invalidate cache
  const userRole = await getLeagueRole(session.user.uid, leagueId);
  if (userRole !== "owner") {
    return NextResponse.json({ error: "Forbidden - Owner access required" }, { status: 403 });
  }

  try {
    // Invalidate all caches for this league
    await revalidateRankingsCache(leagueId);

    return NextResponse.json({
      success: true,
      message: "Cache invalidated successfully",
      leagueId,
      invalidatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cache invalidation error:", error);
    return NextResponse.json(
      { error: "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}
