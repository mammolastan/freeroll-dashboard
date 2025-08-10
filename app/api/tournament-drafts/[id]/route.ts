// app/api/tournament-drafts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const draftId = parseInt(params.id);

    const draft = await prisma.$queryRaw`
      SELECT 
        td.*,
        COUNT(tdp.id) as player_count
      FROM tournament_drafts td
      LEFT JOIN tournament_draft_players tdp ON td.id = tdp.tournament_draft_id
      WHERE td.id = ${draftId}
      GROUP BY td.id
    `;

    if (!(draft as any[]).length) {
      return NextResponse.json(
        { error: "Tournament draft not found" },
        { status: 404 }
      );
    }

    return NextResponse.json((draft as any[])[0]);
  } catch (error) {
    console.error("Error fetching tournament draft:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournament draft" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const draftId = parseInt(params.id);
    const { tournament_date, director_name, venue, start_points } = body;

    await prisma.$queryRaw`
      UPDATE tournament_drafts 
      SET 
        tournament_date = ${tournament_date},
        director_name = ${director_name},
        venue = ${venue},
        start_points = ${start_points || 0},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${draftId}
    `;

    const updatedDraft = await prisma.$queryRaw`
      SELECT * FROM tournament_drafts WHERE id = ${draftId}
    `;

    return NextResponse.json(updatedDraft);
  } catch (error) {
    console.error("Error updating tournament draft:", error);
    return NextResponse.json(
      { error: "Failed to update tournament draft" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = parseInt(params.id);

    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Check if tournament exists and get its status
    const existingTournament = await prisma.$queryRaw`
      SELECT id, status FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if ((existingTournament as any[]).length === 0) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    const tournament = (existingTournament as any[])[0];

    // Prevent deletion of integrated tournaments (optional - you can remove this if you want to allow deletion of integrated tournaments)
    if (tournament.status === "integrated") {
      return NextResponse.json(
        { error: "Cannot delete integrated tournaments" },
        { status: 400 }
      );
    }

    // Use Prisma's transaction functionality
    await prisma.$transaction(async (tx) => {
      // Delete all players first (due to foreign key constraint)
      await tx.$executeRaw`
        DELETE FROM tournament_draft_players 
        WHERE tournament_draft_id = ${tournamentId}
      `;

      // Delete the tournament
      await tx.$executeRaw`
        DELETE FROM tournament_drafts 
        WHERE id = ${tournamentId}
      `;
    });

    return NextResponse.json({
      success: true,
      message: "Tournament deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tournament:", error);
    return NextResponse.json(
      {
        error: "Failed to delete tournament",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
