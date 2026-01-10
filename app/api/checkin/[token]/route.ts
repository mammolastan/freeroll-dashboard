// app/api/checkin/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

// Get tournament info by check-in token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        td.id,
        td.tournament_date,
        td.director_name,
        td.venue,
        td.start_points,
        td.status,
        COUNT(tdp.id) as player_count
      FROM tournament_drafts td
      LEFT JOIN tournament_draft_players tdp ON td.id = tdp.tournament_draft_id
      WHERE td.check_in_token = ${token} AND td.status = 'in_progress'
      GROUP BY td.id
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found or check-in not available" },
        { status: 404 }
      );
    }

    const tournamentData = tournament[0];

    return NextResponse.json({
      id: Number(tournamentData.id),
      tournament_date: tournamentData.tournament_date,
      director_name: tournamentData.director_name,
      venue: tournamentData.venue,
      start_points: Number(tournamentData.start_points),
      player_count: Number(tournamentData.player_count),
    });
  } catch (error) {
    console.error("Error fetching tournament for check-in:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournament information" },
      { status: 500 }
    );
  }
}
