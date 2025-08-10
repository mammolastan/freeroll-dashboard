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
    const draftId = parseInt(params.id);

    // Check if draft can be deleted (only in_progress status)
    const draft = await prisma.$queryRaw`
      SELECT status FROM tournament_drafts WHERE id = ${draftId}
    `;

    if (!draft || (draft as any[])[0]?.status !== "in_progress") {
      return NextResponse.json(
        { error: "Can only delete drafts in progress" },
        { status: 400 }
      );
    }

    await prisma.$queryRaw`
      DELETE FROM tournament_drafts WHERE id = ${draftId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tournament draft:", error);
    return NextResponse.json(
      { error: "Failed to delete tournament draft" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
