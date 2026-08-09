import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole, canAccessAdmin } from '@/lib/league-auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  // Admin permission check
  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get opted-in players with phone numbers
  const players = await prisma.players_v2.findMany({
    where: {
      league_id: leagueId,
      sms_opt_in: true,
      phone_number: { not: null },
    },
    select: {
      id: true,
      uid: true,
      first_name: true,
      last_name: true,
    },
    orderBy: [
      { first_name: 'asc' },
      { last_name: 'asc' },
    ],
  });

  // Format for the frontend
  const recipients = players.map((p) => ({
    id: p.id,
    playerUid: p.uid,
    name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
  }));

  return NextResponse.json({
    count: recipients.length,
    recipients,
  });
}
