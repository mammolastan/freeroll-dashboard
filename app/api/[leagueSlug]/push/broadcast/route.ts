import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole, canAccessAdmin } from '@/lib/league-auth';
import { broadcastToLeague, sendToSubscriber } from '@/lib/push/sendPush';
import { prisma } from '@/lib/prisma';

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
  const { message, subscriberId } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  if (message.trim().length > 200) {
    return NextResponse.json({ error: 'Message too long (max 200 characters)' }, { status: 400 });
  }

  // Fetch league settings for icon
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://openbarleague.com';
  let iconUrl = `${baseUrl}/icons/default-icon-512.png`;
  try {
    const league = await prisma.leagues.findUnique({
      where: { id: leagueId },
      select: { league_settings: true },
    });
    if (league?.league_settings) {
      const config = JSON.parse(league.league_settings as string);
      if (config?.pwa?.logoUrl) {
        const logoPath = config.pwa.logoUrl;
        iconUrl = logoPath.startsWith('http') ? logoPath : `${baseUrl}${logoPath}`;
      }
    }
  } catch (e) {
    console.error('[push] Failed to parse league settings for icon:', e);
  }

  const payload = {
    title: '📢 League Announcement',
    body: message.trim(),
    url: `/l/${leagueSlug}`,
    icon: iconUrl,
  };

  // If subscriberId provided, send only to that subscriber; otherwise broadcast to all
  const result = subscriberId
    ? await sendToSubscriber(subscriberId, payload)
    : await broadcastToLeague(leagueId, payload);

  return NextResponse.json(result);
}
