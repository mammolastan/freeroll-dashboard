import * as webpush from 'web-push';
import { prisma } from '@/lib/prisma';

let vapidInitialized = false;

function ensureVapidInitialized() {
  if (!vapidInitialized) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    vapidInitialized = true;
  }
}

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
  ensureVapidInitialized();

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

/**
 * Send a push notification to players who are checked into a specific tournament
 * and have push notifications enabled for that league.
 * Automatically removes expired (410/404) subscriptions.
 */
export async function sendToCheckedInPlayers(
  tournamentId: number,
  payload: PushPayload
): Promise<BroadcastResult> {
  ensureVapidInitialized();

  // Get push subscriptions for players checked into this tournament
  // Join tournament_draft_players -> push_subscriptions via player_uid
  // Also need to match league_id from the tournament
  const subs = await prisma.$queryRawUnsafe<
    { id: number; endpoint: string; p256dh: string; auth: string }[]
  >(
    `SELECT DISTINCT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     INNER JOIN tournament_draft_players tdp ON ps.player_uid COLLATE utf8mb4_unicode_520_ci = tdp.player_uid
     INNER JOIN tournament_drafts td ON tdp.tournament_draft_id = td.id
     WHERE tdp.tournament_draft_id = ?
       AND tdp.checked_in_at IS NOT NULL
       AND tdp.knockedout_at IS NULL
       AND ps.league_id = td.league_id`,
    tournamentId
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

  console.log(`[push] sendToCheckedInPlayers tournamentId=${tournamentId}: sent=${sent} failed=${failed} removed=${removed}`);
  return { sent, failed, removed };
}

/**
 * Send a push notification to a single subscriber by ID.
 * Automatically removes the subscription if expired (410/404).
 */
export async function sendToSubscriber(
  subscriberId: number,
  payload: PushPayload
): Promise<BroadcastResult> {
  ensureVapidInitialized();

  const subs = await prisma.$queryRawUnsafe<
    { id: number; endpoint: string; p256dh: string; auth: string }[]
  >(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE id = ?',
    subscriberId
  );

  if (subs.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const sub = subs[0];
  let sent = 0;
  let failed = 0;
  let removed = 0;

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
      await prisma.$executeRawUnsafe(
        'DELETE FROM push_subscriptions WHERE id = ?',
        sub.id
      );
      removed++;
    } else {
      failed++;
      console.error('[push] sendNotification error:', err.statusCode, err.message);
    }
  }

  console.log(`[push] sendToSubscriber id=${subscriberId}: sent=${sent} failed=${failed} removed=${removed}`);
  return { sent, failed, removed };
}

/**
 * Send a push notification to ALL devices of a specific player by UID.
 * Queries all push_subscriptions for the player_uid and league_id,
 * sends to each subscription, and automatically removes expired (410/404) subscriptions.
 */
export async function sendToPlayerByUid(
  playerUid: string,
  leagueId: number,
  payload: PushPayload
): Promise<BroadcastResult> {
  ensureVapidInitialized();

  const subs = await prisma.$queryRawUnsafe<
    { id: number; endpoint: string; p256dh: string; auth: string }[]
  >(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE player_uid = ? AND league_id = ?',
    playerUid,
    leagueId
  );

  if (subs.length === 0) {
    console.log(`[push] sendToPlayerByUid: No subscriptions found for player_uid=${playerUid} league_id=${leagueId}`);
    return { sent: 0, failed: 0, removed: 0 };
  }

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

  console.log(`[push] sendToPlayerByUid player_uid=${playerUid} league_id=${leagueId}: sent=${sent} failed=${failed} removed=${removed}`);
  return { sent, failed, removed };
}
