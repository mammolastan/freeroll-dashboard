import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole, canAccessAdmin } from '@/lib/league-auth';
import { prisma } from '@/lib/prisma';
import { sendSms, isTwilioConfigured } from '@/lib/sms/twilioClient';

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  // Check Twilio configuration
  if (!isTwilioConfigured()) {
    return NextResponse.json(
      { error: 'SMS is not configured on this server' },
      { status: 503 }
    );
  }

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

  // Parse request body
  let body: { message?: string; playerId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message, playerId } = body;

  // Validate message
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // Get league name for message formatting
  const league = await prisma.leagues.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });
  const leagueName = league?.name ?? 'League';

  // Calculate max allowed message length
  // Format: "{leagueName}: {message} STOP 2 end"
  const maxMessageLength = 160 - leagueName.length - 2 - 11; // 2 for ": ", 11 for " STOP 2 end"

  if (message.length > maxMessageLength) {
    return NextResponse.json(
      { error: `Message too long (max ${maxMessageLength} characters)` },
      { status: 400 }
    );
  }

  // Format the full message with league name and opt-out
  const fullMessage = `${leagueName}: ${message} STOP 2 end`;

  // Build query - optionally filter to a single player
  const whereClause: {
    league_id: number;
    sms_opt_in: boolean;
    phone_number: { not: null };
    id?: number;
  } = {
    league_id: leagueId,
    sms_opt_in: true,
    phone_number: { not: null },
  };

  if (playerId) {
    whereClause.id = playerId;
  }

  // Get opted-in players with phone numbers
  const players = await prisma.players_v2.findMany({
    where: whereClause,
    select: {
      id: true,
      phone_number: true,
      first_name: true,
      last_name: true,
    },
  });

  if (players.length === 0) {
    const errorMsg = playerId
      ? 'Player not found or has not opted in to SMS'
      : 'No opted-in players with phone numbers';
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const targetDesc = playerId
    ? `player ${players[0].first_name} ${players[0].last_name}`
    : `${players.length} players`;

  console.log(
    `[SMS Broadcast] Sending to ${targetDesc} in league ${leagueId} by ${session.user.uid}: "${fullMessage}"`
  );

  // Send messages in parallel with rate limiting consideration
  const results = await Promise.allSettled(
    players.map(async (player: { phone_number: string | null }) => {
      if (!player.phone_number) {
        return { success: false, error: 'No phone number' };
      }
      return sendSms(player.phone_number, fullMessage);
    })
  );

  // Count successes and failures
  const succeeded = results.filter(
    (r): r is PromiseFulfilledResult<{ success: boolean }> =>
      r.status === 'fulfilled' && r.value.success
  ).length;
  const failed = results.length - succeeded;

  console.log(
    `[SMS Broadcast] Complete: ${succeeded} sent, ${failed} failed`
  );

  return NextResponse.json({
    sent: succeeded,
    failed,
    total: players.length,
  });
}
