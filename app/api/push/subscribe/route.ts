import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST — save a PushSubscription for the authenticated user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { subscription, leagueId } = body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
  }

  if (!leagueId || typeof leagueId !== 'number') {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
  }

  try {
    // Upsert: update keys if the endpoint already exists (e.g., browser renewed the subscription)
    await prisma.$executeRawUnsafe(
      `INSERT INTO push_subscriptions (player_uid, league_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         player_uid = VALUES(player_uid),
         league_id = VALUES(league_id),
         p256dh = VALUES(p256dh),
         auth = VALUES(auth)`,
      session.user.uid,
      leagueId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    );
  } catch (err) {
    console.error('[push/subscribe] DB error:', err);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove a subscription by endpoint
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    'DELETE FROM push_subscriptions WHERE endpoint = ? AND player_uid = ?',
    endpoint,
    session.user.uid
  );

  return NextResponse.json({ ok: true });
}
