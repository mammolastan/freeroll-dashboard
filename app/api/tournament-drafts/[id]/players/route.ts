// app/api/tournament-drafts/[id]/players/route.ts
import { NextRequest, NextResponse } from "next/server";

import { RealtimeAPI } from "@/lib/realtime";

import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { createCheckInFeedItem } from "@/lib/feed/feedService";

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
        COALESCE(tdp.player_nickname, p.nickname) as player_nickname
      FROM tournament_draft_players tdp
      LEFT JOIN players p ON tdp.player_uid = p.UID
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
    const validAddedBy = ['admin', 'self_checkin', 'kiosk'].includes(added_by) ? added_by : 'admin';

    // Check for duplicate player in same tournament
    const existingPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_draft_players
      WHERE tournament_draft_id = ${draftId} AND player_name = ${player_name}
    `;

    if (existingPlayer.length > 0) {
      return NextResponse.json(
        { error: "Player already exists in this tournament" },
        { status: 400 }
      );
    }

    await prisma.$queryRaw`
      INSERT INTO tournament_draft_players
      (tournament_draft_id, player_name, player_nickname, player_uid, is_new_player, added_by, checked_in_at)
          VALUES (${draftId}, ${player_name}, ${player_nickname}, ${player_uid}, ${
      is_new_player || false
    }, ${validAddedBy}, UTC_TIMESTAMP())
      `;

    const newPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_draft_players WHERE id = LAST_INSERT_ID()
    `;

    // Create feed item for check-in (use nickname if available)
    try {
      await createCheckInFeedItem(draftId, player_name, player_uid, player_nickname);
    } catch (error) {
      console.error("Failed to create check-in feed item:", error);
      // Don't fail the add if feed item creation fails
    }

    // Emit Socket.IO event for real-time updates
    if (Array.isArray(newPlayer) && newPlayer.length > 0) {
      const playerId = newPlayer[0].id;
      if (typeof playerId === 'number') {
        await RealtimeAPI.playerAdded(draftId, playerId);
      }
    }

    return NextResponse.json(newPlayer);
  } catch (error) {
    console.error("Error adding draft player:", error);
    return NextResponse.json(
      { error: "Failed to add player" },
      { status: 500 }
    );
  }
}
