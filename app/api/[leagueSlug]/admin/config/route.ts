import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole, canAccessAdmin } from '@/lib/league-auth';
import { getLeagueConfig, saveLeagueConfig } from '@/lib/league-config';
import { LeagueConfig } from '@/types/league-config';

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
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

  const config = await getLeagueConfig(leagueId);
  return NextResponse.json({ config, role });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

  let body: Partial<LeagueConfig>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  await saveLeagueConfig(leagueId, body);

  console.log(`[admin/config] League ${leagueId} config updated by ${session.user.uid}`);

  const updated = await getLeagueConfig(leagueId);
  return NextResponse.json({ config: updated });
}
