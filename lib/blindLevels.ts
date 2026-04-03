import { prisma } from "@/lib/prisma";

export interface BlindLevel {
  level: number;
  duration: number;   // minutes
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  isbreak?: boolean;
}

export interface BlindSchedule {
  id: string;
  name: string;
  description: string;
  levels: BlindLevel[];
}

/**
 * Resolve a blind schedule to its BlindLevel array.
 * scheduleId is always a numeric string (e.g. "1", "42") pointing
 * to the blind_schedules table. When leagueId is provided, only system
 * schedules (league_id IS NULL) or that league's schedules match.
 * When omitted (e.g. Socket.IO server), any active row with that id matches.
 *
 * Falls back to a minimal emergency schedule if the DB lookup fails.
 */
export async function resolveBlindSchedule(
  scheduleId: string | null | undefined,
  leagueId?: number
): Promise<BlindLevel[]> {
  const numericId = scheduleId ? parseInt(scheduleId, 10) : NaN;

  if (!isNaN(numericId)) {
    try {
      const row =
        leagueId != null
          ? await prisma.$queryRaw<{ levels: string }[]>`
              SELECT levels FROM blind_schedules
              WHERE id = ${numericId}
                AND is_active = 1
                AND (league_id IS NULL OR league_id = ${leagueId})
              LIMIT 1
            `
          : await prisma.$queryRaw<{ levels: string }[]>`
              SELECT levels FROM blind_schedules
              WHERE id = ${numericId}
                AND is_active = 1
              LIMIT 1
            `;
      if (row.length > 0) {
        return JSON.parse(row[0].levels) as BlindLevel[];
      }
    } catch (err) {
      console.error("[resolveBlindSchedule] DB lookup failed:", err);
    }
  }

  // Emergency fallback — should never be reached in normal operation
  console.warn("[resolveBlindSchedule] Falling back to emergency schedule for id:", scheduleId);
  return EMERGENCY_FALLBACK;
}

/**
 * Minimal fallback used only if the DB is unreachable.
 * Not exposed to the UI — the dropdown always uses DB data.
 */
const EMERGENCY_FALLBACK: BlindLevel[] = [
  { level: 1, duration: 20, smallBlind: 100,  bigBlind: 200,  isbreak: false },
  { level: 2, duration: 20, smallBlind: 200,  bigBlind: 400,  isbreak: false },
  { level: 3, duration: 20, smallBlind: 300,  bigBlind: 600,  isbreak: false },
  { level: 4, duration: 20, smallBlind: 500,  bigBlind: 1000, isbreak: false },
  { level: 5, duration: 15, smallBlind: 0,    bigBlind: 0,    isbreak: true  },
  { level: 6, duration: 20, smallBlind: 1000, bigBlind: 2000, isbreak: false },
  { level: 7, duration: 20, smallBlind: 2000, bigBlind: 4000, isbreak: false },
  { level: 8, duration: 20, smallBlind: 5000, bigBlind: 10000,isbreak: false },
];
