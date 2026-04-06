// app/api/tournaments/[id]/gameview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Tournament, Player, GameViewData } from "@/lib/realtime/types";
import { getLeagueConfig } from "@/lib/league-config";

interface TournamentRow {
  id: number;
  title: string;
  tournament_date: string | Date;
  tournament_time: string | null;
  venue: string | null;
  status: string;
  start_points: number;
  director_name: string | null;
  league_id: number;
  allow_chat: boolean | null;
}

interface PlayerRow {
  id: number;
  player_name: string;
  player_nickname: string | null;
  player_uid: string | null;
  is_new_player: boolean | number;
  checked_in_at: string | Date | null;
  created_at: string | Date;
  ko_position: number | null;
  placement: number | null;
  hitman_name: string | null;
  photo_url?: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Fetch tournament data — venue label comes from venues.name via venue_id
    const tournamentResult = await prisma.$queryRaw<TournamentRow[]>`
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
        td.status,
        td.start_points,
        td.director_name,
        td.league_id,
        td.allow_chat
      FROM tournament_drafts td
      LEFT JOIN venues v ON td.venue_id = v.id
      WHERE td.id = ${tournamentId}
    `;

    if (!tournamentResult || tournamentResult.length === 0) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    const tournamentRow = tournamentResult[0];

    // Get league config for timezone and defaults
    const leagueConfig = await getLeagueConfig(tournamentRow.league_id);

    // Resolve effective allow_chat value (tournament override or league default)
    // Note: MySQL returns 0/1 for booleans in raw queries, need to check for null explicitly
    const effectiveAllowChat = tournamentRow.allow_chat === null
      ? leagueConfig.gameDefaults.allowChat
      : Boolean(tournamentRow.allow_chat);

    // Fetch players with their photo URLs from the players table
    const playersResult = await prisma.$queryRaw<PlayerRow[]>`
      SELECT
        tdp.id,
        tdp.player_name,
        COALESCE(tdp.player_nickname, p.nickname) as player_nickname,
        tdp.player_uid,
        tdp.is_new_player,
        tdp.checked_in_at,
        tdp.created_at,
        tdp.ko_position,
        tdp.placement,
        tdp.hitman_name,
        p.photo_url
      FROM tournament_draft_players tdp
      LEFT JOIN players_v2 p ON tdp.player_uid = p.uid
      WHERE tdp.tournament_draft_id = ${tournamentId}
      ORDER BY tdp.created_at ASC
    `;

    // Transform tournament data
    const tournament: Tournament = {
      id: tournamentRow.id,
      title: tournamentRow.title,
      date: new Date(tournamentRow.tournament_date),
      time: tournamentRow.tournament_time,
      venue: tournamentRow.venue,
      status: (tournamentRow.status as Tournament['status']) || 'active',
      max_players: null,
      start_points: Number(tournamentRow.start_points) || 0,
      td: tournamentRow.director_name || null,
      timezone: leagueConfig.timezone,
      allow_chat: effectiveAllowChat,
    };

    // Transform players data
    const players: Player[] = playersResult.map((row) => {
      const isActive = row.ko_position === null;

      return {
        id: row.id,
        name: row.player_name,
        nickname: row.player_nickname,
        uid: row.player_uid,
        is_new_player: Boolean(row.is_new_player),
        checked_in_at: row.checked_in_at ? new Date(row.checked_in_at) : null,
        created_at: new Date(row.created_at),
        is_active: isActive,
        eliminated_at: !isActive && row.ko_position ? new Date() : null, // Approximation
        eliminated_by_player_id: null,
        elimination_position: row.ko_position,
        placement: row.placement,
        photo_url: row.photo_url || null,
        hitman: row.hitman_name
          ? {
            id: null,
            name: row.hitman_name,
            nickname: null,
          }
          : undefined,
      };
    });

    const gameViewData: GameViewData = {
      tournament,
      players,
    };

    return NextResponse.json(gameViewData);
  } catch (error) {
    console.error("Error fetching game view data:", error);
    return NextResponse.json(
      { error: "Failed to fetch game view data" },
      { status: 500 }
    );
  }
}
