// app/api/games/player/[id]/route.ts
// This route updates an appearance record for a player in a game
// Note: The ID is now the appearance composite key (game_id, player_id)
// For backward compatibility, we use a combined ID format: "gameId_playerId"

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const data = await request.json();

    // The id can be either:
    // 1. A combined "gameId_playerId" format for the new schema
    // 2. Just a player_id when game context is provided in body
    let gameId: number;
    let playerId: number;

    if (paramId.includes('_')) {
      // New format: gameId_playerId
      const [gId, pId] = paramId.split('_');
      gameId = parseInt(gId);
      playerId = parseInt(pId);
    } else if (data.gameId) {
      // Old format with gameId in body
      gameId = parseInt(data.gameId);
      playerId = parseInt(paramId);
    } else {
      return NextResponse.json(
        { error: "Invalid ID format. Expected 'gameId_playerId' or gameId in body" },
        { status: 400 }
      );
    }

    // Update the appearance record
    const appearance = await prisma.appearances.update({
      where: {
        game_id_player_id: {
          game_id: gameId,
          player_id: playerId,
        }
      },
      data: {
        placement: data.placement,
        points: data.totalPoints,
        player_score: data.playerScore,
      },
      include: {
        players_v2: true,
      }
    });

    // Return in a format compatible with the old response
    return NextResponse.json({
      id: `${gameId}_${playerId}`,
      name: `${appearance.players_v2.first_name || ''} ${appearance.players_v2.last_name || ''}`.trim(),
      uid: appearance.players_v2.uid,
      placement: appearance.placement,
      startPoints: 0,
      hitman: null,
      totalPoints: appearance.points,
      playerScore: appearance.player_score,
    });
  } catch (error) {
    console.error("Error updating player:", error);
    return NextResponse.json(
      { error: "Failed to update player" },
      { status: 500 }
    );
  }
}
