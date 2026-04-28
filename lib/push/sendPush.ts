import * as webpush from 'web-push';
import { prisma } from '@/lib/prisma';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export interface BroadcastResult {
  sent: number;
  failed: number;
  removed: number;
}

/**
 * Send a push notification to all subscribed devices in a league.
 * Automatically removes expired (410/404) subscriptions.
 */
export async function broadcastToLeague(
  leagueId: number,
  payload: PushPayload
): Promise<BroadcastResult> {
  const subs = await prisma.$queryRawUnsafe<
    { id: number; endpoint: string; p256dh: string; auth: string }[]
  >(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE league_id = ?',
    leagueId
  );

  let sent = 0;
  let failed = 0;
  let removed = 0;
  const staleIds: number[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or unregistered — clean up
        staleIds.push(sub.id);
        removed++;
      } else {
        failed++;
        console.error('[push] sendNotification error:', err.statusCode, err.message);
      }
    }
  }

  if (staleIds.length > 0) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM push_subscriptions WHERE id IN (${staleIds.map(() => '?').join(',')})`,
      ...staleIds
    );
  }

  console.log(`[push] broadcast leagueId=${leagueId}: sent=${sent} failed=${failed} removed=${removed}`);
  return { sent, failed, removed };
}
