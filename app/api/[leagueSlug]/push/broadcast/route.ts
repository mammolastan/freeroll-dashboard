import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole, canAccessAdmin } from '@/lib/league-auth';
import { broadcastToLeague } from '@/lib/push/sendPush';

interface RouteContext {
  params: Promise<{ leagueSlug: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
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

  const body = await req.json();
  const { message } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  if (message.trim().length > 200) {
    return NextResponse.json({ error: 'Message too long (max 200 characters)' }, { status: 400 });
  }

  const result = await broadcastToLeague(leagueId, {
    title: '📢 League Announcement',
    body: message.trim(),
    url: `/${leagueSlug}`,
  });

  return NextResponse.json(result);
}
