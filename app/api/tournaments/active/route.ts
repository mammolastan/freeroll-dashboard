// app/api/tournaments/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types"
import { getLeagueIdFromRequest } from "@/lib/league-utils";
import { getLeagueConfig } from "@/lib/league-config";

// Disable caching for this route to always get fresh tournament data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const leagueId = await getLeagueIdFromRequest(request);
    const leagueConfig = await getLeagueConfig(leagueId);

    const activeTournaments = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        td.id,
        td.tournament_date,
        td.tournament_time,
        td.director_name,
        td.title as game_title,
        v.name AS venue,
        v.cutoff_time AS venue_cutoff_time,
        td.start_points,
        td.status,
        td.blind_schedule,
        td.timer_current_level,
        td.timer_is_running,
        td.timer_is_paused,
        td.created_at,
        td.updated_at,
        COUNT(tdp.id) as total_players,
        COUNT(CASE WHEN tdp.id IS NOT NULL AND tdp.ko_position IS NULL THEN 1 END) as players_remaining
      FROM tournament_drafts td
      LEFT JOIN venues v ON td.venue_id = v.id
      LEFT JOIN tournament_draft_players tdp ON td.id = tdp.tournament_draft_id
      WHERE td.status = 'in_progress'
        AND td.tournament_date >= CURDATE() - INTERVAL 1 DAY
        AND td.league_id = ${leagueId}
      GROUP BY td.id
      ORDER BY td.tournament_date DESC, td.created_at DESC
    `;

    // Serialize BigInt values and format time
    const serializedTournaments = (activeTournaments).map(
      (tournament) => {
        let formattedTime = null;

        if (tournament.tournament_time) {
          // Handle different types that MySQL might return for TIME field
          if (tournament.tournament_time instanceof Date) {
            // If it's a Date object, extract time parts
            const hours = tournament.tournament_time.getUTCHours();
            const minutes = tournament.tournament_time.getUTCMinutes();
            formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
              .toString()
              .padStart(2, "0")}`;
          } else if (typeof tournament.tournament_time === "string") {
            // If it's already a string, just take HH:MM part
            formattedTime = tournament.tournament_time.substring(0, 5);
          } else {
            // For any other type (Buffer, etc), convert to string first
            const timeStr = String(tournament.tournament_time);
            // Check if it looks like HH:MM:SS format
            if (timeStr.includes(":")) {
              formattedTime = timeStr.substring(0, 5);
            }
          }
        }

        const cutoffMinutes =
          tournament.venue_cutoff_time != null
            ? Number(tournament.venue_cutoff_time)
            : leagueConfig.gameDefaults.lateRegistrationWindowMinutes;

        return {
          ...tournament,
          id: Number(tournament.id),
          start_points: Number(tournament.start_points),
          total_players: Number(tournament.total_players),
          players_remaining: Number(tournament.players_remaining),
          tournament_time: formattedTime,
          timezone: leagueConfig.timezone,
          cutoffMinutes,
        };
      }
    );

    return NextResponse.json(serializedTournaments);
  } catch (error) {
    console.error("Error fetching active tournaments:", error);
    return NextResponse.json(
      { error: "Failed to fetch active tournaments" },
      { status: 500 }
    );
  }
}
