// app/api/tournament-drafts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - List all tournament drafts
export async function GET() {
  try {
    const drafts = await prisma.$queryRaw`
      SELECT 
        td.*,
        COUNT(tdp.id) as player_count
      FROM tournament_drafts td
      LEFT JOIN tournament_draft_players tdp ON td.id = tdp.tournament_draft_id
      GROUP BY td.id
      ORDER BY td.tournament_date DESC, td.updated_at DESC
    `;

    // Serialize BigInt values
    const serializedDrafts = (drafts as any[]).map((draft) => ({
      ...draft,
      id: Number(draft.id),
      start_points: Number(draft.start_points),
      player_count: Number(draft.player_count),
    }));

    return NextResponse.json(serializedDrafts);
  } catch (error) {
    console.error("Error fetching tournament drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournament drafts" },
      { status: 500 }
    );
  }
}

// POST - Create new tournament draft
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournament_date, tournament_time, director_name, venue, start_points } = body;

    console.log("Creating tournament with data:", body);

    // Validate required fields
    if (!tournament_date || !venue) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: tournament_date and venue are required",
        },
        { status: 400 }
      );
    }

    // Insert the new tournament draft
    const result = await prisma.$executeRaw`
      INSERT INTO tournament_drafts
      (tournament_date, tournament_time, director_name, venue, start_points, created_by, status)
      VALUES (${tournament_date}, ${tournament_time || null}, ${director_name || ""}, ${venue}, ${
      start_points || 0
    }, 'admin', 'in_progress')
    `;

    console.log("Insert result:", result);

    // Get the inserted record
    const newDraft = await prisma.$queryRaw`
      SELECT * FROM tournament_drafts 
      WHERE id = LAST_INSERT_ID()
    `;

    console.log("New draft created:", newDraft);

    // Serialize the response
    const serializedDraft = (newDraft as any[]).map((draft) => ({
      ...draft,
      id: Number(draft.id),
      start_points: Number(draft.start_points),
    }));

    return NextResponse.json(serializedDraft[0]);
  } catch (error) {
    console.error("Error creating tournament draft:", error);
    return NextResponse.json(
      {
        error: "Failed to create tournament draft",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
