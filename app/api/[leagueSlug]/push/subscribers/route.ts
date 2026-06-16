import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole, canAccessAdmin } from '@/lib/league-auth';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { leagueSlug } = await params;

  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch subscribers with player names
  const subscribers = await prisma.$queryRaw<
    { id: number; player_uid: string; player_name: string | null }[]
  >`
    SELECT DISTINCT
      ps.id,
      ps.player_uid,
      p.name as player_name
    FROM push_subscriptions ps
    LEFT JOIN players_v2 p ON ps.player_uid = p.uid
    WHERE ps.league_id = ${leagueId}
    ORDER BY p.name ASC
  `;

  return NextResponse.json(
    subscribers.map((s) => ({
      id: s.id,
      playerUid: s.player_uid,
      name: s.player_name || s.player_uid,
    }))
  );
}
