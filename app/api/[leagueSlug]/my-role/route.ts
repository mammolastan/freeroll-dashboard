// app/api/[leagueSlug]/my-role/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { getLeagueRole } from "@/lib/league-auth";

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

// GET current user's role in this league
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { leagueSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.uid) {
    return NextResponse.json({ role: null, isGlobalAdmin: false });
  }

  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);

  return NextResponse.json({
    role,
  });
}
