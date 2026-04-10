// lib/fetch-tournament-realtime-snapshot.ts
// Single source for tournament row → Tournament (gameview API, Socket.IO joinRoom, broadcasts).

import { prisma } from "@/lib/prisma";
import { getLeagueConfig } from "@/lib/league-config";
import type { Tournament } from "@/lib/realtime/types";

interface TournamentDraftRow {
  id: number;
  title: string;
  tournament_date: string | Date;
  tournament_time: unknown;
  venue: string | null;
  venue_cutoff_time: number | null;
  status: string;
  start_points: number;
  director_name: string | null;
  league_id: number;
  allow_chat: boolean | null | number;
  allow_self_checkin: boolean | null | number;
}

function normalizeTournamentTime(raw: unknown): string | null {
  if (raw == null) return null;
  if (Buffer.isBuffer(raw)) return raw.toString("utf-8");
  return String(raw);
}

export async function fetchTournamentRealtimeSnapshot(
  tournamentId: number
): Promise<Tournament | null> {
  const tournamentResult = await prisma.$queryRaw<TournamentDraftRow[]>`
    SELECT
      td.id,
      CONCAT(
        COALESCE(v.name, 'Tournament'),
        ' - ',
        DATE_FORMAT(td.tournament_date, '%m/%d/%Y')
      ) as title,
      td.tournament_date,
      td.tournament_time,
      v.name as venue,
      v.cutoff_time as venue_cutoff_time,
      td.status,
      td.start_points,
      td.director_name,
      td.league_id,
      td.allow_chat,
      td.allow_self_checkin
    FROM tournament_drafts td
    LEFT JOIN venues v ON td.venue_id = v.id
    WHERE td.id = ${tournamentId}
  `;

  if (!tournamentResult?.length) return null;

  const row = tournamentResult[0];
  const leagueConfig = await getLeagueConfig(Number(row.league_id));

  const effectiveAllowChat =
    row.allow_chat === null || row.allow_chat === undefined
      ? leagueConfig.gameDefaults.allowChat
      : Boolean(row.allow_chat);

  const effectiveAllowSelfCheckin =
    row.allow_self_checkin === null || row.allow_self_checkin === undefined
      ? leagueConfig.gameDefaults.allowSelfCheckIn
      : Boolean(row.allow_self_checkin);

  const cutoffMinutes =
    row.venue_cutoff_time != null
      ? Number(row.venue_cutoff_time)
      : leagueConfig.gameDefaults.lateRegistrationWindowMinutes;

  return {
    id: row.id,
    title: row.title != null ? String(row.title) : "Tournament",
    date: new Date(row.tournament_date),
    time: normalizeTournamentTime(row.tournament_time),
    venue: row.venue != null ? String(row.venue) : null,
    status: (row.status as Tournament["status"]) || "active",
    max_players: null,
    start_points: Number(row.start_points) || 0,
    td: row.director_name ? String(row.director_name) : null,
    timezone: leagueConfig.timezone,
    allow_chat: effectiveAllowChat,
    allow_self_checkin: effectiveAllowSelfCheckin,
    cutoffMinutes,
  };
}
