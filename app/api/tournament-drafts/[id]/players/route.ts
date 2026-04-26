// app/api/tournament-drafts/[id]/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addPlayerToTournament, AddedBy } from "@/lib/tournament/addPlayer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const draftId = parseInt(id);

    const players = await prisma.$queryRaw`
      SELECT
        tdp.*,
        COALESCE(tdp.player_nickname, p.nickname) as player_nickname,
        p.photo_url
      FROM tournament_draft_players tdp
      LEFT JOIN players_v2 p ON tdp.player_uid = p.uid
      WHERE tdp.tournament_draft_id = ${draftId}
      ORDER BY tdp.created_at ASC
    `;

    return NextResponse.json(players);
  } catch (error) {
    console.error("Error fetching draft players:", error);
    return NextResponse.json(
      { error: "Failed to fetch draft players" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params;
    const draftId = parseInt(id);
    const { player_name, player_nickname, player_uid, is_new_player, added_by } = body;

    // Validate added_by value, default to 'admin'
    const validAddedBy: AddedBy = ['admin', 'self_checkin', 'kiosk'].includes(added_by)
      ? added_by
      : 'admin';

    const result = await addPlayerToTournament({
      tournamentDraftId: draftId,
      player_name,
      player_nickname,
      player_uid,
      is_new_player: is_new_player || false,
      added_by: validAddedBy,
      request,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.errorType === "duplicate" ? 400 : 500 }
      );
    }

    // Return in array format to match previous behavior
    return NextResponse.json([result.player]);
  } catch (error) {
    console.error("Error adding draft player:", error);
    return NextResponse.json(
      { error: "Failed to add player" },
      { status: 500 }
    );
  }
}
