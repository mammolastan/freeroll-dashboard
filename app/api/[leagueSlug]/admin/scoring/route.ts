import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole, canAccessAdmin } from '@/lib/league-auth';
import { getLeagueConfig, saveLeagueConfig } from '@/lib/league-config';
import { DEFAULT_SCORING_SYSTEM, ScoringSystemConfig } from '@/types/league-config';
import { validateScoringSystem } from '@/lib/scoring';

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
  const scoringSystem: ScoringSystemConfig = config.scoringSystem ?? DEFAULT_SCORING_SYSTEM;

  return NextResponse.json({ scoringSystem });
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

  let body: { scoringSystem: ScoringSystemConfig };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { scoringSystem } = body;

  // Validate
  const errors = validateScoringSystem(scoringSystem);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  // Sort rules ascending by placement before saving
  scoringSystem.rules = [...scoringSystem.rules].sort((a, b) => a.placement - b.placement);

  // Save using the league-config helper
  await saveLeagueConfig(leagueId, { scoringSystem });

  console.log(`[admin/scoring] League ${leagueId} scoring config updated by ${session.user.uid}`);

  return NextResponse.json({ success: true, scoringSystem });
}
