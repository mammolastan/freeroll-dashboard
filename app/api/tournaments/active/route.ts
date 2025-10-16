// app/api/tournaments/active/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Disable caching for this route to always get fresh tournament data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const activeTournaments = await prisma.$queryRaw`
      SELECT 
        td.id,
        td.tournament_date,
        td.director_name,
        td.venue,
        td.start_points,
        td.status,
        td.blind_schedule,
        td.timer_current_level,
        td.created_at,
        td.updated_at,
        COUNT(tdp.id) as total_players,
        COUNT(CASE WHEN tdp.hitman_name IS NULL THEN 1 END) as players_remaining
      FROM tournament_drafts td
      LEFT JOIN tournament_draft_players tdp ON td.id = tdp.tournament_draft_id
      WHERE td.status = 'in_progress'
      GROUP BY td.id
      ORDER BY td.tournament_date DESC, td.created_at DESC
    `;

    // Serialize BigInt values
    const serializedTournaments = (activeTournaments as any[]).map(
      (tournament) => ({
        ...tournament,
        id: Number(tournament.id),
        start_points: Number(tournament.start_points),
        total_players: Number(tournament.total_players),
        players_remaining: Number(tournament.players_remaining),
      })
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
