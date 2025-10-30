// app/api/tournaments/active/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Disable caching for this route to always get fresh tournament data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const activeTournaments = await prisma.$queryRaw`
      SELECT
        td.id,
        td.tournament_date,
        td.tournament_time,
        td.director_name,
        td.venue,
        td.start_points,
        td.status,
        td.blind_schedule,
        td.timer_current_level,
        td.timer_is_running,
        td.timer_is_paused,
        td.created_at,
        td.updated_at,
        COUNT(tdp.id) as total_players,
        COUNT(CASE WHEN tdp.ko_position IS NULL THEN 1 END) as players_remaining
      FROM tournament_drafts td
      LEFT JOIN tournament_draft_players tdp ON td.id = tdp.tournament_draft_id
      WHERE td.status = 'in_progress' AND td.tournament_date >= CURDATE() - INTERVAL 1 DAY
      GROUP BY td.id
      ORDER BY td.tournament_date DESC, td.created_at DESC
    `;

    // Serialize BigInt values and format time
    const serializedTournaments = (activeTournaments as any[]).map(
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

        return {
          ...tournament,
          id: Number(tournament.id),
          start_points: Number(tournament.start_points),
          total_players: Number(tournament.total_players),
          players_remaining: Number(tournament.players_remaining),
          tournament_time: formattedTime,
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
