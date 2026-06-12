// server.mts

console.log("Server.mts is running");
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { decode } from "next-auth/jwt";
import { resolveBlindSchedule, BlindLevel } from "./lib/blindLevels.mjs";
import { TypedServer } from "./types/socket.js";
import { AuditActionType, AuditActionCategory, AuditLogValue, AuditValue } from "./types/audit.js";
import type { LeagueConfig } from "./types/league-config.js";
import { DEFAULT_LEAGUE_CONFIG as DEFAULT_LEAGUE_CONFIG_MJS } from "./types/league-config-defaults.mjs";
import type { Tournament } from "./lib/realtime/types.js";
import webpush from "web-push";

// Socket.IO auth types
interface SocketUser {
  uid: string;
  name: string;
  leagueId: number;
}

type LeagueRole = 'owner' | 'admin' | null;

const DEFAULT_LEAGUE_CONFIG = DEFAULT_LEAGUE_CONFIG_MJS as LeagueConfig;

// Initialize Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Configure web-push for push notifications
if (process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

interface PushBroadcastResult {
  sent: number;
  failed: number;
  removed: number;
}

/**
 * Send push notifications to all checked-in players in a tournament
 * who have push subscriptions for the league.
 */
async function sendToTournamentPlayers(
  tournamentId: number,
  payload: PushPayload
): Promise<PushBroadcastResult> {
  const subs = await prisma.$queryRawUnsafe<
    { id: number; endpoint: string; p256dh: string; auth: string }[]
  >(
    `SELECT DISTINCT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     INNER JOIN tournament_draft_players tdp ON ps.player_uid COLLATE utf8mb4_unicode_520_ci = tdp.player_uid
     INNER JOIN tournament_drafts td ON tdp.tournament_draft_id = td.id
     WHERE tdp.tournament_draft_id = ?
       AND tdp.checked_in_at IS NOT NULL
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
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 410 || error.statusCode === 404) {
        staleIds.push(sub.id);
        removed++;
      } else {
        failed++;
        console.error('[push] sendNotification error:', error.statusCode, error.message);
      }
    }
  }

  if (staleIds.length > 0) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM push_subscriptions WHERE id IN (${staleIds.map(() => '?').join(',')})`,
      ...staleIds
    );
  }

  console.log(`[push] tournament ${tournamentId}: sent=${sent} failed=${failed} removed=${removed}`);
  return { sent, failed, removed };
}

// Socket audit logging helper
interface SocketAuditParams {
  tournamentId: number;
  actionType: AuditActionType;
  actionCategory: AuditActionCategory;
  actorId?: number | null;
  actorName?: string | null;
  previousValue?: AuditLogValue | null;
  newValue?: AuditLogValue | null;
  metadata?: Record<string, AuditValue> | null;
  ipAddress?: string | null;
}

async function logSocketAuditEvent(params: SocketAuditParams): Promise<void> {
  try {
    await prisma.tournamentAuditLog.create({
      data: {
        tournament_id: params.tournamentId,
        action_type: params.actionType,
        action_category: params.actionCategory,
        actor_id: params.actorId ?? null,
        actor_name: params.actorName ?? null,
        target_player_id: null,
        target_player_name: null,
        previous_value: params.previousValue !== null && params.previousValue !== undefined
          ? JSON.stringify(params.previousValue) : null,
        new_value: params.newValue !== null && params.newValue !== undefined
          ? JSON.stringify(params.newValue) : null,
        metadata: params.metadata !== null && params.metadata !== undefined
          ? JSON.stringify(params.metadata) : null,
        ip_address: params.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error('Socket audit logging failed:', error);
  }
}

// Type for raw query results from Prisma
type RawQueryResult = Record<string, unknown>;

// Global type declaration for Socket.IO instance
declare global {
  var socketIoInstance: TypedServer | undefined;
}

// Helper: post blind level change to tournament feed
async function postBlindLevelChangeFeedItem(
  tournamentId: number,
  level: number,
  blindLevel: BlindLevel
): Promise<void> {
  try {
    const message = level === 1
      ? `Timer running, shuffle up and deal! Good luck to the winner.`
      : blindLevel.isbreak
        ? `Break time!`
        : `Blinds up! Level ${level}: ${blindLevel.smallBlind}/${blindLevel.bigBlind}${blindLevel.ante ? ` (Ante: ${blindLevel.ante})` : ''}`;

    await prisma.$executeRaw`
      INSERT INTO tournament_feed_items
      (tournament_draft_id, item_type, message_text, created_at)
      VALUES (${tournamentId}, 'system', ${message}, NOW())
    `;

    const newItem = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_feed_items WHERE id = LAST_INSERT_ID()
    `;

    if (newItem.length > 0) {
      const item = newItem[0];
      global.socketIoInstance?.to(tournamentId.toString()).emit('feed:new_item', {
        tournament_id: tournamentId,
        item: {
          id: Number(item.id),
          item_type: 'system' as const,
          author_uid: null,
          author_name: null,
          message_text: message,
          eliminated_player_name: null,
          hitman_name: null,
          ko_position: null,
          created_at: item.created_at instanceof Date
            ? item.created_at.toISOString()
            : String(item.created_at),
        }
      });
    }

    console.log(`[FEED] Posted blind level change: ${message}`);
  } catch (error) {
    console.error('Failed to post blind level change to feed:', error);
  }
}

// Timer state management
interface TimerState {
  tournamentId: number;
  currentLevel: number;
  timeRemaining: number; // in seconds
  isRunning: boolean;
  isPaused: boolean;
  blindLevels: BlindLevel[];
  lastUpdate: number; // timestamp
  serverTime?: number; // Unix ms timestamp at moment of broadcast (for clock skew compensation)
}

// Resolved lazily per tournament — no hard-coded default constant needed

// Store timer states for each tournament
const timerStates = new Map<number, TimerState>();

// Timer helper functions
async function getOrCreateTimerState(
  tournamentId: number
): Promise<TimerState | null> {
  if (!timerStates.has(tournamentId)) {
    console.log(`Initializing timer state for tournament ${tournamentId}`);

    // First try to load existing timer state from database
    const existingState = await loadTimerStateFromDB(tournamentId);
    if (existingState) {
      console.log(
        `Loaded existing timer state from database for tournament ${tournamentId}`
      );
      timerStates.set(tournamentId, existingState);
      return existingState;
    }

    // No existing state found, create new timer state
    console.log(`Creating new timer state for tournament ${tournamentId}`);

    // Fetch tournament's blind schedule from database
    let blindLevels: BlindLevel[];
    try {
      const tournament = await prisma.tournamentDraft.findUnique({
        where: { id: tournamentId },
        select: { blind_schedule: true, custom_blind_levels: true },
      });

      // If tournament doesn't exist, don't create a timer state for it
      if (!tournament) {
        console.log(`Tournament ${tournamentId} not found in database, skipping timer creation`);
        return null;
      }

      console.log(
        `Tournament ${tournamentId} blind_schedule:`,
        tournament?.blind_schedule,
        `has custom levels:`,
        !!tournament?.custom_blind_levels
      );

      // Check for custom blind levels first, then fall back to DB schedule
      if (tournament?.custom_blind_levels) {
        try {
          blindLevels = JSON.parse(tournament.custom_blind_levels as string);
          console.log(`Using custom blind levels with ${blindLevels.length} levels`);
        } catch (parseError) {
          console.error("Error parsing custom_blind_levels, falling back to DB schedule:", parseError);
          blindLevels = await resolveBlindSchedule(tournament.blind_schedule ?? null);
        }
      } else {
        blindLevels = await resolveBlindSchedule(tournament.blind_schedule ?? null);
        console.log(`Using DB schedule id="${tournament.blind_schedule}" with ${blindLevels.length} levels`);
      }
    } catch (error) {
      console.error("Error fetching tournament blind schedule:", error);
      return null; // Don't create timer state if we can't verify tournament exists
    }

    const currentLevel = 1;
    const currentBlindLevel = blindLevels[0];
    console.log(
      `Creating timer state: level ${currentLevel}, time ${currentBlindLevel.duration * 60
      }s`
    );

    const newTimerState: TimerState = {
      tournamentId,
      currentLevel,
      timeRemaining: currentBlindLevel.duration * 60, // convert to seconds
      isRunning: false,
      isPaused: false,
      blindLevels,
      lastUpdate: Date.now(),
    };

    timerStates.set(tournamentId, newTimerState);

    // Save initial state to database
    await saveTimerStateToDB(tournamentId, newTimerState);
  }
  return timerStates.get(tournamentId) || null;
}

async function updateTimer(tournamentId: number): Promise<TimerState | null> {
  const timer = await getOrCreateTimerState(tournamentId);
  if (!timer) return null;
  let stateChanged = false;

  if (timer.isRunning && !timer.isPaused) {
    const now = Date.now();
    const elapsed = Math.floor((now - timer.lastUpdate) / 1000);

    // Only update if at least 1 second has actually elapsed
    if (elapsed > 0) {
      const newTimeRemaining = Math.max(0, timer.timeRemaining - elapsed);

      if (newTimeRemaining !== timer.timeRemaining) {
        timer.timeRemaining = newTimeRemaining;
        stateChanged = true;
      }

      // CRITICAL FIX: Only update lastUpdate when we actually deduct time
      // This prevents drift from processing overhead
      timer.lastUpdate = timer.lastUpdate + elapsed * 1000;

      // Auto-advance to next level if time expires
      if (
        timer.timeRemaining === 0 &&
        timer.currentLevel < timer.blindLevels.length
      ) {
        const previousLevel = timer.currentLevel;
        const currentLevelData = timer.blindLevels[timer.currentLevel - 1];
        timer.currentLevel++;
        const nextLevel = timer.blindLevels[timer.currentLevel - 1];
        if (nextLevel) {
          timer.timeRemaining = nextLevel.duration * 60;
          await postBlindLevelChangeFeedItem(tournamentId, timer.currentLevel, nextLevel);

          // Audit log: AUTO_BLIND_ADVANCE (System action)
          await logSocketAuditEvent({
            tournamentId,
            actionType: 'AUTO_BLIND_ADVANCE',
            actionCategory: 'SYSTEM',
            actorId: null,
            actorName: null,
            previousValue: {
              blindLevel: previousLevel,
              timeRemaining: 0,
            },
            newValue: {
              blindLevel: timer.currentLevel,
              timeRemaining: timer.timeRemaining,
              isBreak: nextLevel.isbreak ?? false,
            },
            metadata: {
              auto: true,
              previousLevelDuration: currentLevelData?.duration ?? null,
            },
            ipAddress: null,
          });

          // If current level is a break, pause the timer after advancing to next level
          if (currentLevelData?.isbreak) {
            timer.isPaused = true;
            console.log(
              `Break ended for tournament ${tournamentId}, pausing at level ${timer.currentLevel}`
            );

            // Audit log: BREAK_ENDED (System action)
            await logSocketAuditEvent({
              tournamentId,
              actionType: 'BREAK_ENDED',
              actionCategory: 'SYSTEM',
              actorId: null,
              actorName: null,
              previousValue: {
                isBreak: true,
                blindLevel: previousLevel,
              },
              newValue: {
                isBreak: false,
                blindLevel: timer.currentLevel,
                isPaused: true,
              },
              metadata: {
                breakLevelNumber: previousLevel,
                resumingAtLevel: timer.currentLevel,
              },
              ipAddress: null,
            });
          }

          // If new level is a break, log BREAK_STARTED
          if (nextLevel.isbreak) {
            await logSocketAuditEvent({
              tournamentId,
              actionType: 'BREAK_STARTED',
              actionCategory: 'SYSTEM',
              actorId: null,
              actorName: null,
              previousValue: {
                isBreak: false,
                blindLevel: previousLevel,
              },
              newValue: {
                isBreak: true,
                blindLevel: timer.currentLevel,
                breakDuration: nextLevel.duration,
              },
              metadata: {
                breakAfterLevel: previousLevel,
              },
              ipAddress: null,
            });
          }
        }
        stateChanged = true;
      } else if (timer.timeRemaining === 0 && timer.currentLevel >= timer.blindLevels.length) {
        // Final level reached - stop the timer
        timer.isRunning = false;
        console.log(`Tournament ${tournamentId} timer completed - reached final level ${timer.currentLevel}`);
        stateChanged = true;
      }
    }
  }

  // Save to database if significant state change occurred
  if (stateChanged) {
    await saveTimerStateToDB(tournamentId, timer);
  }

  return timer;
}

async function startTimer(tournamentId: number): Promise<TimerState | null> {
  const timer = await getOrCreateTimerState(tournamentId);
  if (!timer) return null;
  timer.isRunning = true;
  timer.isPaused = false;
  timer.lastUpdate = Date.now();

  // Save state change to database
  await saveTimerStateToDB(tournamentId, timer);

  return timer;
}

async function pauseTimer(tournamentId: number): Promise<TimerState | null> {
  const timer = await updateTimer(tournamentId);
  if (!timer) return null;
  timer.isPaused = true;

  // Save state change to database
  await saveTimerStateToDB(tournamentId, timer);

  return timer;
}

async function resumeTimer(tournamentId: number): Promise<TimerState | null> {
  const timer = await getOrCreateTimerState(tournamentId);
  if (!timer) return null;
  timer.isPaused = false;
  timer.lastUpdate = Date.now();

  // Save state change to database
  await saveTimerStateToDB(tournamentId, timer);

  return timer;
}

async function resetTimer(tournamentId: number): Promise<TimerState | null> {
  const timer = await getOrCreateTimerState(tournamentId);
  if (!timer) return null;

  // Reload blind schedule from database in case it changed
  let blindLevels: BlindLevel[];
  try {
    const tournament = await prisma.tournamentDraft.findUnique({
      where: { id: tournamentId },
      select: { blind_schedule: true, custom_blind_levels: true },
    });

    // Check for custom blind levels first, then fall back to DB schedule
    if (tournament?.custom_blind_levels) {
      try {
        blindLevels = JSON.parse(tournament.custom_blind_levels as string);
        console.log(`Reset timer: using custom blind levels with ${blindLevels.length} levels`);
      } catch (parseError) {
        console.error("Error parsing custom_blind_levels during reset, falling back to DB schedule:", parseError);
        blindLevels = await resolveBlindSchedule(tournament.blind_schedule ?? null);
      }
    } else {
      blindLevels = await resolveBlindSchedule(tournament?.blind_schedule ?? null);
      console.log(`Reset timer: using DB schedule id="${tournament?.blind_schedule}" with ${blindLevels.length} levels`);
    }
  } catch (error) {
    console.error("Error fetching tournament blind schedule during reset:", error);
    blindLevels = await resolveBlindSchedule(null); // Use fallback
  }

  timer.blindLevels = blindLevels;
  timer.currentLevel = 1;
  timer.timeRemaining = timer.blindLevels[0].duration * 60;
  timer.isRunning = false;
  timer.isPaused = false;
  timer.lastUpdate = Date.now();

  // Save state change to database
  await saveTimerStateToDB(tournamentId, timer);

  return timer;
}

// Server startup recovery function
async function recoverActiveTimers(): Promise<void> {
  try {
    console.log("Recovering active timers from database...");

    // Find all tournaments with active timer states
    const activeTimers = await prisma.tournamentDraft.findMany({
      where: {
        OR: [{ timer_is_running: true }, { timer_is_paused: true }],
      },
      select: {
        id: true,
        timer_current_level: true,
        timer_remaining_seconds: true,
        timer_is_running: true,
        timer_is_paused: true,
        timer_last_updated: true,
        blind_schedule: true,
        custom_blind_levels: true,
      },
    });

    console.log(`Found ${activeTimers.length} active timers to recover`);

    for (const tournament of activeTimers) {
      try {
        // Load the timer state using our existing function
        const recoveredTimer = await loadTimerStateFromDB(tournament.id);

        if (recoveredTimer) {
          timerStates.set(tournament.id, recoveredTimer);
          console.log(
            `Recovered timer for tournament ${tournament.id}: level ${recoveredTimer.currentLevel}, time ${recoveredTimer.timeRemaining}s, running: ${recoveredTimer.isRunning}, paused: ${recoveredTimer.isPaused}`
          );
        }
      } catch (error) {
        console.error(
          `Failed to recover timer for tournament ${tournament.id}:`,
          error
        );
      }
    }

    console.log("Timer recovery completed");
  } catch (error) {
    console.error("Error during timer recovery:", error);
  }
}

// Database persistence functions
async function saveTimerStateToDB(
  tournamentId: number,
  timerState: TimerState
): Promise<void> {
  try {
    await prisma.tournamentDraft.update({
      where: { id: tournamentId },
      data: {
        timer_current_level: timerState.currentLevel,
        timer_remaining_seconds: timerState.timeRemaining,
        timer_is_running: timerState.isRunning,
        timer_is_paused: timerState.isPaused,
        timer_last_updated: new Date(),
      },
    });
    console.log(`Timer state saved to DB for tournament ${tournamentId}`);
  } catch (error) {
    console.error("Error saving timer state to database:", error);
  }
}

async function loadTimerStateFromDB(
  tournamentId: number
): Promise<TimerState | null> {
  try {
    const tournament = await prisma.tournamentDraft.findUnique({
      where: { id: tournamentId },
      select: {
        blind_schedule: true,
        custom_blind_levels: true,
        timer_current_level: true,
        timer_remaining_seconds: true,
        timer_is_running: true,
        timer_is_paused: true,
        timer_last_updated: true,
      },
    });

    if (!tournament) return null;

    // Only load timer state if the timer is actually active (running or paused)
    // If both are false, the timer is stopped and should not be recovered
    if (!tournament.timer_is_running && !tournament.timer_is_paused) {
      console.log(
        `Timer for tournament ${tournamentId} is stopped, not loading state`
      );
      return null;
    }

    // If timer data exists and was recently updated
    if (tournament.timer_last_updated && tournament.timer_current_level) {
      console.log(`Loading timer state from DB for tournament ${tournamentId}`);

      let adjustedTimeRemaining = tournament.timer_remaining_seconds || 0;

      // If timer was running, calculate elapsed time since last update
      if (tournament.timer_is_running && !tournament.timer_is_paused) {
        const now = new Date();
        const elapsedSeconds = Math.floor(
          (now.getTime() - tournament.timer_last_updated.getTime()) / 1000
        );
        adjustedTimeRemaining = Math.max(
          0,
          adjustedTimeRemaining - elapsedSeconds
        );
        console.log(
          `Timer was running, adjusted time: ${adjustedTimeRemaining}s (elapsed: ${elapsedSeconds}s)`
        );
      }

      // Get blind levels - check for custom levels first, then fall back to DB schedule
      let blindLevels: BlindLevel[];
      if (tournament.custom_blind_levels) {
        try {
          blindLevels = JSON.parse(tournament.custom_blind_levels as string);
          console.log(`Loading custom blind levels with ${blindLevels.length} levels`);
        } catch (parseError) {
          console.error("Error parsing custom_blind_levels, falling back to DB schedule:", parseError);
          blindLevels = await resolveBlindSchedule(tournament.blind_schedule ?? null);
        }
      } else {
        blindLevels = await resolveBlindSchedule(tournament.blind_schedule ?? null);
      }

      return {
        tournamentId,
        currentLevel: tournament.timer_current_level,
        timeRemaining: adjustedTimeRemaining,
        isRunning: tournament.timer_is_running || false,
        isPaused: tournament.timer_is_paused || false,
        blindLevels,
        lastUpdate: Date.now(),
      };
    }

    return null;
  } catch (error) {
    console.error("Error loading timer state from database:", error);
    return null;
  }
}

// ==========================================
// Socket.IO Authorization Helpers
// ==========================================

/**
 * Get the league_id for a tournament draft.
 * Mirrors getLeagueIdForDraft in lib/auth-utils.ts for Socket.IO context.
 */
async function getLeagueIdForDraft(draftId: number): Promise<number | null> {
  const draft = await prisma.$queryRaw<{ league_id: number }[]>`
    SELECT league_id FROM tournament_drafts WHERE id = ${draftId}
  `;
  return draft.length ? Number(draft[0].league_id) : null;
}

/**
 * Get a user's role in a league.
 * Mirrors getLeagueRole in lib/league-auth.ts for Socket.IO context.
 */
async function getLeagueRole(playerUid: string, leagueId: number): Promise<LeagueRole> {
  const row = await prisma.league_roles.findUnique({
    where: {
      unique_member: { league_id: leagueId, player_uid: playerUid },
    },
    select: { role: true },
  });
  if (!row) return null;
  return row.role as LeagueRole;
}

/**
 * Check if a role has admin access.
 * Mirrors canAccessAdmin in lib/league-auth.ts.
 */
function canAccessAdmin(role: LeagueRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Check if socket user has admin access for a specific tournament.
 * Returns the verified user info if authorized, null otherwise.
 */
async function checkTournamentAdmin(
  socket: { data: { user?: SocketUser | null } },
  tournamentId: number
): Promise<{ user: SocketUser; role: LeagueRole } | null> {
  const user = socket.data.user;
  if (!user) return null;

  const leagueId = await getLeagueIdForDraft(tournamentId);
  if (!leagueId) return null;

  const role = await getLeagueRole(user.uid, leagueId);
  if (!canAccessAdmin(role)) return null;

  return { user, role };
}

// ==========================================
// League Config Helper
// ==========================================

// Loaded inline so `npm run dev:socket` (tsx) does not import
// fetch-tournament-realtime-snapshot.ts, which could mix CJS/ESM and break
// named ESM imports from server.mts.
async function getLeagueConfigFromDb(leagueId: number): Promise<LeagueConfig> {
  const league = await prisma.leagues.findUnique({
    where: { id: leagueId },
    select: { league_settings: true },
  });

  if (!league?.league_settings) {
    return { ...DEFAULT_LEAGUE_CONFIG };
  }

  try {
    const stored = JSON.parse(league.league_settings) as Partial<LeagueConfig>;
    return {
      ...DEFAULT_LEAGUE_CONFIG,
      ...stored,
      gameDefaults: {
        ...DEFAULT_LEAGUE_CONFIG.gameDefaults,
        ...(stored.gameDefaults ?? {}),
      },
      socialLinks: {
        ...DEFAULT_LEAGUE_CONFIG.socialLinks,
        ...(stored.socialLinks ?? {}),
      },
      pwa: {
        ...DEFAULT_LEAGUE_CONFIG.pwa,
        ...(stored.pwa ?? {}),
      },
    };
  } catch {
    console.error(
      `[Server] Failed to parse league_settings for league ${leagueId}`,
    );
    return { ...DEFAULT_LEAGUE_CONFIG };
  }
}

function normalizeTournamentTimeForServer(raw: unknown): string | null {
  if (raw == null) return null;
  if (Buffer.isBuffer(raw)) return raw.toString("utf-8");
  return String(raw);
}

async function getTournamentData(
  tournamentDraftId: number,
): Promise<Tournament | null> {
  try {
    const tournamentResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        td.id,
        td.title as custom_title,
        CONCAT(
          COALESCE(v.name, 'Tournament'),
          ' - ',
          DATE_FORMAT(td.tournament_date, '%m/%d/%Y')
        ) as default_title,
        td.tournament_date,
        td.tournament_time,
        v.name as venue,
        td.status,
        td.start_points,
        td.director_name,
        td.league_id,
        td.allow_chat,
        td.allow_self_checkin
      FROM tournament_drafts td
      LEFT JOIN venues v ON td.venue_id = v.id
      WHERE td.id = ${tournamentDraftId}
      LIMIT 1
    `;

    if (!Array.isArray(tournamentResult) || tournamentResult.length === 0) {
      return null;
    }

    const row = tournamentResult[0];
    const leagueConfig = await getLeagueConfigFromDb(Number(row.league_id));

    const allowRaw = row.allow_chat;
    const effectiveAllowChat =
      allowRaw === null || allowRaw === undefined
        ? leagueConfig.gameDefaults.allowChat
        : Boolean(allowRaw);

    const allowSelfCheckinRaw = row.allow_self_checkin;
    const effectiveAllowSelfCheckin =
      allowSelfCheckinRaw === null || allowSelfCheckinRaw === undefined
        ? leagueConfig.gameDefaults.allowSelfCheckIn
        : Boolean(allowSelfCheckinRaw);

    // Use custom title if set, otherwise use default (Venue - Date)
    const title = row.custom_title && String(row.custom_title).trim()
      ? String(row.custom_title)
      : row.default_title != null ? String(row.default_title) : "Tournament";

    return {
      id: Number(row.id),
      title,
      date: new Date(row.tournament_date as string | Date),
      time: normalizeTournamentTimeForServer(row.tournament_time),
      venue: row.venue != null ? String(row.venue) : null,
      status: (String(row.status) as Tournament["status"]) || "active",
      max_players: null,
      start_points: Number(row.start_points) || 0,
      td: row.director_name ? String(row.director_name) : null,
      timezone: leagueConfig.timezone,
      allow_chat: effectiveAllowChat,
      allow_self_checkin: effectiveAllowSelfCheckin,
      cutoffMinutes: leagueConfig.gameDefaults.lateRegistrationWindowMinutes,
    };
  } catch (error) {
    console.error("Error fetching tournament data:", error);
    return null;
  }
}

async function getCheckedInPlayers(tournamentDraftId: number) {
  try {
    const players = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        tdp.*,
        COALESCE(tdp.player_nickname, p.nickname) as resolved_nickname,
        p.photo_url
      FROM tournament_draft_players tdp
      LEFT JOIN players_v2 p ON tdp.player_uid = p.uid
      WHERE tdp.tournament_draft_id = ${tournamentDraftId}
      ORDER BY tdp.created_at ASC
    `;

    return players.map((p) => ({
      id: Number(p.id),
      name: String(p.player_name),
      nickname: p.resolved_nickname ? String(p.resolved_nickname) : null,
      uid: p.player_uid ? String(p.player_uid) : null,
      is_new_player: Boolean(p.is_new_player),
      checked_in_at: p.checked_in_at || null,
      created_at: p.created_at || null,
      is_active: p.ko_position === null, // Active if no ko_position
      eliminated_at: p.knockedout_at || null,
      eliminated_by_player_id: null,
      elimination_position: p.ko_position ? Number(p.ko_position) : null,
      placement: p.placement ? Number(p.placement) : null,
      photo_url: p.photo_url ? String(p.photo_url) : null,
      // Include both formats for compatibility with different client components
      hitman_name: p.hitman_name ? String(p.hitman_name) : null,
      knockedout_at: p.knockedout_at || null,
      hitman: p.hitman_name
        ? {
          id: null,
          name: String(p.hitman_name),
          nickname: null,
        }
        : undefined,
    }));
  } catch (error) {
    console.error("Error fetching checked-in players:", error);
    return [];
  }
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  try {
    const httpServer = createServer(handle);
    const io = new Server(httpServer, {
      cors: {
        origin: true, // Allow same origin
        credentials: true, // Allow cookies
      },
    });

    // ==========================================
    // Socket.IO Authentication Middleware
    // ==========================================
    io.use(async (socket, next) => {
      try {
        // Extract NextAuth session token from cookies
        const cookieHeader = socket.handshake.headers.cookie;
        if (!cookieHeader) {
          // No cookies - anonymous user, allowed to connect
          socket.data.user = null;
          return next();
        }

        // Parse cookies to find the session token
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map(c => {
            const [key, ...val] = c.trim().split('=');
            return [key, val.join('=')];
          })
        );

        // NextAuth uses different cookie names in dev vs prod
        const tokenCookie = cookies['next-auth.session-token'] ||
                           cookies['__Secure-next-auth.session-token'];

        if (!tokenCookie) {
          // No session token - anonymous user
          socket.data.user = null;
          return next();
        }

        // Decode the JWT
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
          console.error('NEXTAUTH_SECRET not set - cannot verify session');
          socket.data.user = null;
          return next();
        }

        const decoded = await decode({
          token: tokenCookie,
          secret,
        });

        if (decoded && decoded.uid && typeof decoded.uid === 'string') {
          socket.data.user = {
            uid: decoded.uid,
            name: (decoded.name as string) || 'Unknown',
            leagueId: (decoded.leagueId as number) || 1,
          };
          console.log(`Socket ${socket.id} authenticated as ${socket.data.user.name} (${socket.data.user.uid})`);
        } else {
          socket.data.user = null;
        }

        next();
      } catch (error) {
        console.error('Socket auth error:', error);
        // Don't reject connection - just mark as unauthenticated
        socket.data.user = null;
        next();
      }
    });

    // Make Socket.IO instance available globally for API routes
    global.socketIoInstance = io as unknown as TypedServer;

    // Recover active timers from database on startup
    await recoverActiveTimers();

    // Timer expiry check - runs every second but ONLY broadcasts on level expiry
    // Clients compute their own countdown locally from the lastUpdate timestamp
    setInterval(async () => {
      for (const [tournamentId, timer] of Array.from(timerStates.entries())) {
        if (!timer.isRunning || timer.isPaused) continue;

        const now = Date.now();
        const elapsed = Math.floor((now - timer.lastUpdate) / 1000);

        if (elapsed >= timer.timeRemaining) {
          // Timer expired — delegate to existing updateTimer which handles level advance
          const previousLevel = timer.currentLevel;
          const wasRunning = timer.isRunning;
          const updatedTimer = await updateTimer(tournamentId);

          if (
            updatedTimer &&
            typeof updatedTimer.timeRemaining === "number" &&
            updatedTimer.blindLevels
          ) {
            const timerPayload = {
              tournamentId: updatedTimer.tournamentId,
              currentLevel: updatedTimer.currentLevel,
              timeRemaining: updatedTimer.timeRemaining,
              isRunning: updatedTimer.isRunning,
              isPaused: updatedTimer.isPaused,
              blindLevels: updatedTimer.blindLevels,
              lastUpdate: updatedTimer.lastUpdate,
              serverTime: Date.now(),
            };
            io.to(tournamentId.toString()).emit("timer:update", timerPayload);

            // Only log if level actually changed or timer stopped
            if (updatedTimer.currentLevel !== previousLevel) {
              console.log(`Timer level expired for tournament ${tournamentId}, advanced to level ${updatedTimer.currentLevel}`);
            } else if (wasRunning && !updatedTimer.isRunning) {
              console.log(`Timer completed for tournament ${tournamentId} at level ${updatedTimer.currentLevel}`);
            }
          }
        }
        // No broadcast on normal ticks — clients compute their own countdown
      }
    }, 1000);

    // Periodic database sync - save all timer states every 30 seconds
    setInterval(async () => {
      for (const [tournamentId, timer] of Array.from(timerStates.entries())) {
        try {
          const tournament = await prisma.tournamentDraft.findUnique({
            where: { id: tournamentId },
            select: { id: true },
          });

          if (!tournament) {
            console.log(`Tournament ${tournamentId} no longer exists, removing timer state`);
            timerStates.delete(tournamentId);
            continue;
          }

          // If running, snapshot the current computed timeRemaining before saving
          if (timer.isRunning && !timer.isPaused) {
            const elapsed = Math.floor((Date.now() - timer.lastUpdate) / 1000);
            timer.timeRemaining = Math.max(0, timer.timeRemaining - elapsed);
            timer.lastUpdate = Date.now();
          }

          await saveTimerStateToDB(tournamentId, timer);
          console.log(`Periodic sync completed for tournament ${tournamentId}`);
        } catch (error) {
          console.error(
            `Periodic sync failed for tournament ${tournamentId}:`,
            error
          );
        }
      }
    }, 30000); // 30 seconds

    io.on("connection", (socket) => {
      // Store client IP for audit logging
      const forwardedFor = socket.handshake.headers['x-forwarded-for'];
      const clientIP = typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : socket.handshake.address || null;
      socket.data.clientIP = clientIP;

      socket.on("joinRoom", async (room) => {
        try {
          socket.join(room);

          // Fetch tournament and player data
          const tournamentDraftId = parseInt(room);
          if (!isNaN(tournamentDraftId)) {
            const [tournament, players] = await Promise.all([
              getTournamentData(tournamentDraftId),
              getCheckedInPlayers(tournamentDraftId),
            ]);

            console.log(`Socket ${socket.id} joined room ${room} (${players?.length || 0} players)`);

            // Send both tournament and player data
            socket.emit("updatePlayers", players);
            if (tournament) {
              socket.emit("tournament:updated", { data: { tournament } });
            }

            // Send current timer state
            const timerState = await updateTimer(tournamentDraftId);

            // Validate timer state before sending
            if (
              timerState &&
              typeof timerState.timeRemaining === "number" &&
              timerState.blindLevels
            ) {
              const timerPayload = {
                tournamentId: timerState.tournamentId,
                currentLevel: timerState.currentLevel,
                timeRemaining: timerState.timeRemaining,
                isRunning: timerState.isRunning,
                isPaused: timerState.isPaused,
                blindLevels: timerState.blindLevels,
                lastUpdate: timerState.lastUpdate,
                serverTime: Date.now(),
              };
              socket.emit("timer:sync", timerPayload);
            } else {
              console.error(
                `Invalid timer sync state for tournament ${tournamentDraftId}:`,
                timerState
              );
            }
          }
        } catch (err) {
          console.error("Failed to fetch tournament/player data:", err);
        }
      });

      socket.on("playerJoined", async ({ tournamentDraftId, newPlayer }) => {
        try {
          console.log(
            `Player joined tournament ${tournamentDraftId}:`,
            newPlayer
          );

          // Fetch updated players list
          const players = await getCheckedInPlayers(tournamentDraftId);

          // Broadcast to all clients in this room
          io.to(tournamentDraftId.toString()).emit("updatePlayers", players);
        } catch (err) {
          console.error("Failed to handle playerJoined event:", err);
        }
      });

      socket.on("message", ({ room, message, sender }) => {
        socket.to(room).emit("message", { sender, message });
      });

      // Timer event handlers
      socket.on("timer:start", async ({ tournamentId }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:start attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        console.log(`Timer start requested for tournament ${tournamentId} by ${auth.user.name}`);

        // Check if this is the initial start (game_started === false)
        const tournamentInfo = await prisma.tournamentDraft.findUnique({
          where: { id: tournamentId },
          select: {
            game_started: true,
            title: true,
            venue: true,
            check_in_token: true,
            leagues: { select: { slug: true, league_settings: true } },
          },
        });

        const isInitialStart = tournamentInfo && !tournamentInfo.game_started;

        // Capture state before starting for audit log
        const previousState = timerStates.get(tournamentId);
        const previousValue = previousState ? {
          isRunning: previousState.isRunning,
          isPaused: previousState.isPaused,
          blindLevel: previousState.currentLevel,
          timeRemaining: previousState.timeRemaining,
        } : null;

        const timerState = await startTimer(tournamentId);

        if (!timerState) {
          console.error(`Cannot start timer - tournament ${tournamentId} not found`);
          return;
        }

        console.log(`Emitting timer update:`, {
          level: timerState.currentLevel,
          time: timerState.timeRemaining,
          isRunning: timerState.isRunning,
        });

        const timerPayload = {
          tournamentId: timerState.tournamentId,
          currentLevel: timerState.currentLevel,
          timeRemaining: timerState.timeRemaining,
          isRunning: timerState.isRunning,
          isPaused: timerState.isPaused,
          blindLevels: timerState.blindLevels,
          lastUpdate: timerState.lastUpdate,
          serverTime: Date.now(),
        };
        io.to(tournamentId.toString()).emit("timer:update", timerPayload);
        console.log(`Timer started for tournament ${tournamentId}`);

        // Post system message when timer first starts
        if (timerState.currentLevel === 1 && timerState.blindLevels[0]) {
          await postBlindLevelChangeFeedItem(tournamentId, 1, timerState.blindLevels[0]);
        }

        // Handle initial start: mark game_started and send push notifications
        if (isInitialStart && tournamentInfo) {
          // Mark game as started
          await prisma.tournamentDraft.update({
            where: { id: tournamentId },
            data: { game_started: true },
          });
          console.log(`Game marked as started for tournament ${tournamentId}`);

          // Send push notifications to checked-in players
          const venueName = tournamentInfo.title || tournamentInfo.venue || 'the venue';
          const leagueSlug = tournamentInfo.leagues?.slug;
          const token = tournamentInfo.check_in_token;

          if (leagueSlug && token) {
            // Determine icon URL from league settings
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://openbarleague.com';
            let iconUrl = `${baseUrl}/icons/default-icon-512.png`; // default fallback
            try {
              const leagueSettings = tournamentInfo.leagues?.league_settings;
              if (leagueSettings) {
                const config = JSON.parse(leagueSettings as string);
                if (config?.pwa?.logoUrl) {
                  // Make relative URLs absolute
                  const logoPath = config.pwa.logoUrl;
                  iconUrl = logoPath.startsWith('http') ? logoPath : `${baseUrl}${logoPath}`;
                }
              }
            } catch (e) {
              console.error('[push] Failed to parse league settings for icon:', e);
            }

            // Fire and forget - don't block timer
            sendToTournamentPlayers(tournamentId, {
              title: 'Tournament Starting!',
              body: `Shuffle up and deal! The tournament at ${venueName} is now underway.`,
              url: `/l/${leagueSlug}/gameview/${token}`,
              icon: iconUrl,
            }).catch((err) => console.error('[push] Timer start notification failed:', err));
          }
        }

        // Audit log: TIMER_STARTED (using server-verified identity)
        await logSocketAuditEvent({
          tournamentId,
          actionType: 'TIMER_STARTED',
          actionCategory: 'ADMIN',
          actorId: null, // UID stored in actorName for now
          actorName: auth.user.name,
          previousValue,
          newValue: {
            isRunning: true,
            isPaused: false,
            blindLevel: timerState.currentLevel,
            timeRemaining: timerState.timeRemaining,
          },
          metadata: {
            firstStart: isInitialStart,
            actorUid: auth.user.uid,
          },
          ipAddress: socket.data.clientIP,
        });
      });

      socket.on("timer:pause", async ({ tournamentId }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:pause attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        // Capture state before pausing for audit log
        const previousState = timerStates.get(tournamentId);
        const previousValue = previousState ? {
          isRunning: previousState.isRunning,
          isPaused: previousState.isPaused,
          blindLevel: previousState.currentLevel,
          timeRemaining: previousState.timeRemaining,
        } : null;

        const timerState = await pauseTimer(tournamentId);
        if (!timerState) {
          console.error(`Cannot pause timer - tournament ${tournamentId} not found`);
          return;
        }
        const timerPayload = {
          tournamentId: timerState.tournamentId,
          currentLevel: timerState.currentLevel,
          timeRemaining: timerState.timeRemaining,
          isRunning: timerState.isRunning,
          isPaused: timerState.isPaused,
          blindLevels: timerState.blindLevels,
          lastUpdate: timerState.lastUpdate,
          serverTime: Date.now(),
        };
        io.to(tournamentId.toString()).emit("timer:update", timerPayload);
        console.log(`Timer paused for tournament ${tournamentId} by ${auth.user.name}`);

        // Audit log: TIMER_PAUSED (using server-verified identity)
        await logSocketAuditEvent({
          tournamentId,
          actionType: 'TIMER_PAUSED',
          actionCategory: 'ADMIN',
          actorId: null,
          actorName: auth.user.name,
          previousValue,
          newValue: {
            isRunning: timerState.isRunning,
            isPaused: true,
            blindLevel: timerState.currentLevel,
            timeRemaining: timerState.timeRemaining,
          },
          metadata: {
            pausedAtLevel: timerState.currentLevel,
            actorUid: auth.user.uid,
          },
          ipAddress: socket.data.clientIP,
        });
      });

      socket.on("timer:resume", async ({ tournamentId }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:resume attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        // Capture state before resuming for audit log
        const previousState = timerStates.get(tournamentId);
        const previousValue = previousState ? {
          isRunning: previousState.isRunning,
          isPaused: previousState.isPaused,
          blindLevel: previousState.currentLevel,
          timeRemaining: previousState.timeRemaining,
        } : null;

        const timerState = await resumeTimer(tournamentId);
        if (!timerState) {
          console.error(`Cannot resume timer - tournament ${tournamentId} not found`);
          return;
        }
        const timerPayload = {
          tournamentId: timerState.tournamentId,
          currentLevel: timerState.currentLevel,
          timeRemaining: timerState.timeRemaining,
          isRunning: timerState.isRunning,
          isPaused: timerState.isPaused,
          blindLevels: timerState.blindLevels,
          lastUpdate: timerState.lastUpdate,
          serverTime: Date.now(),
        };
        io.to(tournamentId.toString()).emit("timer:update", timerPayload);
        console.log(`Timer resumed for tournament ${tournamentId} by ${auth.user.name}`);

        // Audit log: TIMER_RESUMED (using server-verified identity)
        await logSocketAuditEvent({
          tournamentId,
          actionType: 'TIMER_RESUMED',
          actionCategory: 'ADMIN',
          actorId: null,
          actorName: auth.user.name,
          previousValue,
          newValue: {
            isRunning: true,
            isPaused: false,
            blindLevel: timerState.currentLevel,
            timeRemaining: timerState.timeRemaining,
          },
          metadata: {
            resumedFromPause: true,
            actorUid: auth.user.uid,
          },
          ipAddress: socket.data.clientIP,
        });
      });

      socket.on("timer:reset", async ({ tournamentId }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:reset attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        // Capture state before resetting for audit log
        const previousState = timerStates.get(tournamentId);
        const previousValue = previousState ? {
          isRunning: previousState.isRunning,
          isPaused: previousState.isPaused,
          blindLevel: previousState.currentLevel,
          timeRemaining: previousState.timeRemaining,
        } : null;

        const timerState = await resetTimer(tournamentId);
        if (!timerState) {
          console.error(`Cannot reset timer - tournament ${tournamentId} not found`);
          return;
        }
        const timerPayload = {
          tournamentId: timerState.tournamentId,
          currentLevel: timerState.currentLevel,
          timeRemaining: timerState.timeRemaining,
          isRunning: timerState.isRunning,
          isPaused: timerState.isPaused,
          blindLevels: timerState.blindLevels,
          lastUpdate: timerState.lastUpdate,
          serverTime: Date.now(),
        };
        io.to(tournamentId.toString()).emit("timer:update", timerPayload);
        console.log(`Timer reset for tournament ${tournamentId} by ${auth.user.name}`);

        // Audit log: TIMER_RESET (using server-verified identity)
        await logSocketAuditEvent({
          tournamentId,
          actionType: 'TIMER_RESET',
          actionCategory: 'ADMIN',
          actorId: null,
          actorName: auth.user.name,
          previousValue,
          newValue: {
            isRunning: false,
            isPaused: false,
            blindLevel: 1,
            timeRemaining: timerState.timeRemaining,
          },
          metadata: {
            resetToLevel: 1,
            actorUid: auth.user.uid,
          },
          ipAddress: socket.data.clientIP,
        });
      });

      socket.on("timer:requestSync", async ({ tournamentId }) => {
        console.log(`Timer sync requested for tournament ${tournamentId}`);
        const timerState = await getOrCreateTimerState(tournamentId);

        if (!timerState) {
          console.error(`Cannot sync timer - tournament ${tournamentId} not found`);
          return;
        }

        console.log(`Sending timer sync:`, {
          level: timerState.currentLevel,
          time: timerState.timeRemaining,
        });

        const timerPayload = {
          tournamentId: timerState.tournamentId,
          currentLevel: timerState.currentLevel,
          timeRemaining: timerState.timeRemaining,
          isRunning: timerState.isRunning,
          isPaused: timerState.isPaused,
          blindLevels: timerState.blindLevels,
          lastUpdate: timerState.lastUpdate,
          serverTime: Date.now(),
        };
        socket.emit("timer:sync", timerPayload);
      });

      socket.on("timer:nextLevel", async ({ tournamentId }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:nextLevel attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        const timer = await getOrCreateTimerState(tournamentId);
        if (!timer) {
          console.error(`Cannot advance timer - tournament ${tournamentId} not found`);
          return;
        }
        if (timer.currentLevel < timer.blindLevels.length) {
          const previousLevel = timer.currentLevel;
          const previousTimeRemaining = timer.timeRemaining;

          timer.currentLevel++;
          const nextLevel = timer.blindLevels[timer.currentLevel - 1];
          if (nextLevel) {
            timer.timeRemaining = nextLevel.duration * 60;
          }
          timer.lastUpdate = Date.now();

          // Save state change to database
          await saveTimerStateToDB(tournamentId, timer);

          const timerPayload = {
            tournamentId: timer.tournamentId,
            currentLevel: timer.currentLevel,
            timeRemaining: timer.timeRemaining,
            isRunning: timer.isRunning,
            isPaused: timer.isPaused,
            blindLevels: timer.blindLevels,
            lastUpdate: timer.lastUpdate,
            serverTime: Date.now(),
          };
          io.to(tournamentId.toString()).emit("timer:update", timerPayload);
          console.log(
            `Timer advanced to level ${timer.currentLevel} for tournament ${tournamentId} by ${auth.user.name}`
          );

          // Audit log: BLIND_LEVEL_CHANGED (using server-verified identity)
          await logSocketAuditEvent({
            tournamentId,
            actionType: 'BLIND_LEVEL_CHANGED',
            actionCategory: 'ADMIN',
            actorId: null,
            actorName: auth.user.name,
            previousValue: {
              blindLevel: previousLevel,
              timeRemaining: previousTimeRemaining,
            },
            newValue: {
              blindLevel: timer.currentLevel,
              timeRemaining: timer.timeRemaining,
            },
            metadata: {
              direction: 'next',
              manualChange: true,
              isBreak: nextLevel?.isbreak ?? false,
              actorUid: auth.user.uid,
            },
            ipAddress: socket.data.clientIP,
          });
        }
      });

      socket.on("timer:prevLevel", async ({ tournamentId }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:prevLevel attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        const timer = await getOrCreateTimerState(tournamentId);
        if (!timer) {
          console.error(`Cannot go to previous level - tournament ${tournamentId} not found`);
          return;
        }
        if (timer.currentLevel > 1) {
          const previousLevel = timer.currentLevel;
          const previousTimeRemaining = timer.timeRemaining;

          timer.currentLevel--;
          const prevLevel = timer.blindLevels[timer.currentLevel - 1];
          if (prevLevel) {
            timer.timeRemaining = prevLevel.duration * 60;
          }
          timer.lastUpdate = Date.now();

          // Save state change to database
          await saveTimerStateToDB(tournamentId, timer);

          const timerPayload = {
            tournamentId: timer.tournamentId,
            currentLevel: timer.currentLevel,
            timeRemaining: timer.timeRemaining,
            isRunning: timer.isRunning,
            isPaused: timer.isPaused,
            blindLevels: timer.blindLevels,
            lastUpdate: timer.lastUpdate,
            serverTime: Date.now(),
          };
          io.to(tournamentId.toString()).emit("timer:update", timerPayload);
          console.log(
            `Timer moved back to level ${timer.currentLevel} for tournament ${tournamentId} by ${auth.user.name}`
          );

          // Audit log: BLIND_LEVEL_CHANGED (using server-verified identity)
          await logSocketAuditEvent({
            tournamentId,
            actionType: 'BLIND_LEVEL_CHANGED',
            actionCategory: 'ADMIN',
            actorId: null,
            actorName: auth.user.name,
            previousValue: {
              blindLevel: previousLevel,
              timeRemaining: previousTimeRemaining,
            },
            newValue: {
              blindLevel: timer.currentLevel,
              timeRemaining: timer.timeRemaining,
            },
            metadata: {
              direction: 'previous',
              manualChange: true,
              isBreak: prevLevel?.isbreak ?? false,
              actorUid: auth.user.uid,
            },
            ipAddress: socket.data.clientIP,
          });
        }
      });

      socket.on("timer:setTime", async ({ tournamentId, timeInSeconds }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:setTime attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        const timer = await getOrCreateTimerState(tournamentId);
        if (!timer) {
          console.error(`Cannot set time - tournament ${tournamentId} not found`);
          return;
        }

        const previousTimeRemaining = timer.timeRemaining;

        timer.timeRemaining = Math.max(0, timeInSeconds);
        timer.lastUpdate = Date.now();

        // Save state change to database
        await saveTimerStateToDB(tournamentId, timer);

        const timerPayload = {
          tournamentId: timer.tournamentId,
          currentLevel: timer.currentLevel,
          timeRemaining: timer.timeRemaining,
          isRunning: timer.isRunning,
          isPaused: timer.isPaused,
          blindLevels: timer.blindLevels,
          lastUpdate: timer.lastUpdate,
          serverTime: Date.now(),
        };
        io.to(tournamentId.toString()).emit("timer:update", timerPayload);
        console.log(
          `Timer set to ${timeInSeconds} seconds for tournament ${tournamentId} by ${auth.user.name}`
        );

        // Audit log: TIMER_TIME_SET (using server-verified identity)
        await logSocketAuditEvent({
          tournamentId,
          actionType: 'TIMER_TIME_SET',
          actionCategory: 'ADMIN',
          actorId: null,
          actorName: auth.user.name,
          previousValue: {
            timeRemaining: previousTimeRemaining,
          },
          newValue: {
            timeRemaining: timer.timeRemaining,
          },
          metadata: {
            blindLevel: timer.currentLevel,
            manualTimeAdjustment: true,
            actorUid: auth.user.uid,
          },
          ipAddress: socket.data.clientIP,
        });
      });

      socket.on("timer:setSchedule", async ({ tournamentId, scheduleId }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:setSchedule attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        if (!timerStates.has(tournamentId)) {
          return; // Timer not initialized yet
        }

        const timer = timerStates.get(tournamentId)!;

        // Only allow schedule changes when timer is stopped
        if (timer.isRunning && !timer.isPaused) {
          socket.emit("timer:error", {
            message: "Cannot change schedule while timer is running",
          });
          return;
        }

        // Capture previous state for audit log
        const previousLevelCount = timer.blindLevels.length;

        try {
          // Update the timer with new blind levels from DB
          const newBlindLevels = await resolveBlindSchedule(scheduleId);
          timer.blindLevels = newBlindLevels;
          timer.currentLevel = 1;
          timer.timeRemaining = newBlindLevels[0].duration * 60;
          timer.lastUpdate = Date.now();

          const timerPayload = {
            tournamentId: timer.tournamentId,
            currentLevel: timer.currentLevel,
            timeRemaining: timer.timeRemaining,
            isRunning: timer.isRunning,
            isPaused: timer.isPaused,
            blindLevels: timer.blindLevels,
            lastUpdate: timer.lastUpdate,
            serverTime: Date.now(),
          };
          io.to(tournamentId.toString()).emit("timer:update", timerPayload);
          console.log(
            `Timer schedule changed to ${scheduleId} for tournament ${tournamentId} by ${auth.user.name}`
          );

          // Audit log: BLIND_SCHEDULE_CHANGED (using server-verified identity)
          await logSocketAuditEvent({
            tournamentId,
            actionType: 'BLIND_SCHEDULE_CHANGED',
            actionCategory: 'ADMIN',
            actorId: null,
            actorName: auth.user.name,
            previousValue: {
              levelCount: previousLevelCount,
            },
            newValue: {
              scheduleId: scheduleId,
              levelCount: newBlindLevels.length,
            },
            metadata: {
              actorUid: auth.user.uid,
            },
            ipAddress: socket.data.clientIP,
          });
        } catch (error) {
          console.error("Error changing timer schedule:", error);
          socket.emit("timer:error", { message: "Failed to change schedule" });
        }
      });

      // Update blind levels without resetting timer position (for mid-tournament edits)
      socket.on("timer:updateLevels", async ({ tournamentId, levels }) => {
        // Verify admin authorization
        const auth = await checkTournamentAdmin(socket, tournamentId);
        if (!auth) {
          console.log(`Unauthorized timer:updateLevels attempt for tournament ${tournamentId}`);
          socket.emit("timer:error", { message: "Admin access required" });
          return;
        }

        const timer = await getOrCreateTimerState(tournamentId);
        if (!timer) {
          console.error(`Cannot update levels - tournament ${tournamentId} not found`);
          return;
        }

        console.log(`Updating blind levels for tournament ${tournamentId} by ${auth.user.name} (keeping level ${timer.currentLevel}, time ${timer.timeRemaining}s)`);

        // Update the blind levels while preserving current level and time
        timer.blindLevels = levels;

        // Save state change to database
        await saveTimerStateToDB(tournamentId, timer);

        const timerPayload = {
          tournamentId: timer.tournamentId,
          currentLevel: timer.currentLevel,
          timeRemaining: timer.timeRemaining,
          isRunning: timer.isRunning,
          isPaused: timer.isPaused,
          blindLevels: timer.blindLevels,
          lastUpdate: timer.lastUpdate,
          serverTime: Date.now(),
        };
        io.to(tournamentId.toString()).emit("timer:update", timerPayload);
        console.log(
          `Timer levels updated for tournament ${tournamentId} (current level: ${timer.currentLevel}, ${timer.blindLevels.length} total levels)`
        );
      });

      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
      });
    });

    httpServer.listen(port, () => {
      console.log(`Server listening at http://${hostname}:${port}`);
    });
  } catch (err) {
    console.error("Top-level server error:", err);
  }
});
