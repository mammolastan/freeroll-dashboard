// app/api/trigger-player-update/route.ts
import { NextRequest, NextResponse } from "next/server";

// Add type declaration for global.socketIoInstance
declare global {
  // Replace 'any' with the actual type if available
  var socketIoInstance: any | undefined;
}

import { prisma } from "@/lib/prisma";

type CheckedInPlayer = {
  id: number;
  name: string;
  nickname: string | null;
  uid: string;
  is_new_player: boolean;
  checked_in_at: Date | null;
  created_at: Date;
};

async function getCheckedInPlayers(
  tournamentDraftId: number
): Promise<CheckedInPlayer[]> {
  try {
    const players = await prisma.$queryRaw`
      SELECT
        tdp.*,
        p.nickname as player_nickname
      FROM tournament_draft_players tdp
      LEFT JOIN players p ON tdp.player_uid = p.uid
      WHERE tdp.tournament_draft_id = ${tournamentDraftId}
      ORDER BY tdp.created_at ASC
    `;

    return (players as any[]).map((p) => ({
      id: p.id,
      name: p.player_name,
      nickname: p.player_nickname,
      uid: p.player_uid,
      is_new_player: p.is_new_player,
      checked_in_at: p.checked_in_at,
      created_at: p.created_at,
      is_active: p.ko_position === null, // Active if no ko_position
      eliminated_at: null,
      eliminated_by_player_id: null,
      elimination_position: p.ko_position,
      placement: p.placement,
      hitman: p.hitman_name
        ? {
            id: null,
            name: p.hitman_name,
            nickname: null,
          }
        : undefined,
    }));
  } catch (error) {
    console.error("Error fetching checked-in players:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournamentDraftId } = body;

    console.log(
      `[TRIGGER] Broadcasting updated players for tournament ${tournamentDraftId}`
    );

    // Get updated players list
    const players = await getCheckedInPlayers(tournamentDraftId);
    console.log(`[TRIGGER] Found ${players.length} players`);

    // Access the global Socket.IO instance and broadcast directly
    if (global.socketIoInstance) {
      console.log(`[TRIGGER] Broadcasting to room: ${tournamentDraftId}`);
      global.socketIoInstance
        .to(tournamentDraftId.toString())
        .emit("updatePlayers", players);
      return NextResponse.json({ success: true, playersCount: players.length });
    } else {
      console.error("[TRIGGER] Socket.IO instance not available!");
      return NextResponse.json(
        { error: "Socket.IO not available" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in trigger-player-update:", error);
    return NextResponse.json(
      { error: "Failed to trigger player update" },
      { status: 500 }
    );
  }
}
