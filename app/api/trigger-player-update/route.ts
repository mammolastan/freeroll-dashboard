// app/api/trigger-player-update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { TypedServer, RealtimePlayer } from "@/types";

// Add type declaration for global.socketIoInstance
declare global {
  var socketIoInstance: TypedServer | undefined;
}

import { prisma } from "@/lib/prisma";

type PlayerQueryResult = {
  id: number;
  player_name: string;
  player_nickname: string | null;
  player_uid: string;
  is_new_player: boolean;
  checked_in_at: Date | null;
  created_at: Date;
  ko_position: number | null;
  placement: number | null;
  hitman_name: string | null;
};

async function getCheckedInPlayers(
  tournamentDraftId: number
): Promise<RealtimePlayer[]> {
  try {
    const players = await prisma.$queryRaw<PlayerQueryResult[]>`
      SELECT
        tdp.*,
        p.nickname as player_nickname
      FROM tournament_draft_players tdp
      LEFT JOIN players p ON tdp.player_uid = p.uid
      WHERE tdp.tournament_draft_id = ${tournamentDraftId}
      ORDER BY tdp.created_at ASC
    `;

    return players.map((p) => ({
      id: p.id,
      player_name: p.player_name,
      player_nickname: p.player_nickname,
      player_uid: p.player_uid,
      is_new_player: p.is_new_player,
      hitman_name: p.hitman_name,
      ko_position: p.ko_position,
      placement: p.placement,
      checked_in_at: p.checked_in_at,
      added_by: 'admin' as const,
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
        .emit("players:batch_update", {
          tournament_id: tournamentDraftId,
          players,
          action: 'bulk_update'
        });
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
