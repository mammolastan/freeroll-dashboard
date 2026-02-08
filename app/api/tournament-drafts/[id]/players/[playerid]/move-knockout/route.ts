// app/api/tournament-drafts/[id]/players/[playerid]/move-knockout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { emitPlayerJoined } from "@/lib/socketServer";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerid: string }> }
) {
  try {
    const { id, playerid } = await params;
    const body = await request.json();
    const playerId = parseInt(playerid);
    const draftId = parseInt(id);
    const { afterPlayerId } = body; // null = move to first, otherwise the player id to move after

    // Get all knocked out players ordered by knockedout_at, then id
    const knockedOutPlayers = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, knockedout_at
      FROM tournament_draft_players
      WHERE tournament_draft_id = ${draftId}
        AND knockedout_at IS NOT NULL
      ORDER BY knockedout_at ASC, id ASC
    `;

    // Find the player being moved
    const movingPlayer = knockedOutPlayers.find(p => Number(p.id) === playerId);
    if (!movingPlayer) {
      return NextResponse.json(
        { error: "Player not found or not knocked out" },
        { status: 404 }
      );
    }

    let newKnockedoutAt: Date;
    let playersToShift: RawQueryResult[] = [];

    if (afterPlayerId === null) {
      // Move to be the first knockout
      // Find the earliest knockedout_at
      const otherPlayers = knockedOutPlayers.filter(p => Number(p.id) !== playerId);
      if (otherPlayers.length === 0) {
        // This player is the only knocked out player, nothing to do
        return NextResponse.json({ success: true });
      }

      const earliestTime = new Date(otherPlayers[0].knockedout_at as Date).getTime();
      newKnockedoutAt = new Date(earliestTime - 1000);

      // Find players that have the same timestamp as the earliest and might conflict
      // After we set our time to earliestTime - 1s, we need to check if any players
      // have timestamps between our new time and the earliest time
      // Since we're going 1 second before, this shouldn't be an issue
      // But we should check if any players have the same time as newKnockedoutAt
      playersToShift = otherPlayers.filter(p => {
        const pTime = new Date(p.knockedout_at as Date).getTime();
        return pTime === newKnockedoutAt.getTime();
      });

    } else {
      // Move to be after the specified player
      const afterPlayer = knockedOutPlayers.find(p => Number(p.id) === afterPlayerId);
      if (!afterPlayer) {
        return NextResponse.json(
          { error: "Target player not found or not knocked out" },
          { status: 404 }
        );
      }

      const afterPlayerTime = new Date(afterPlayer.knockedout_at as Date).getTime();
      newKnockedoutAt = new Date(afterPlayerTime + 1000);

      // Find the index of afterPlayer in the sorted list
      const afterPlayerIndex = knockedOutPlayers.findIndex(p => Number(p.id) === afterPlayerId);

      // Find all players that come AFTER afterPlayer in the current order
      // and have knockedout_at <= newKnockedoutAt (they would conflict with our new position)
      playersToShift = knockedOutPlayers.filter((p, index) => {
        if (Number(p.id) === playerId) return false; // Don't shift the player we're moving
        if (index <= afterPlayerIndex) return false; // Don't shift players before/at afterPlayer

        const pTime = new Date(p.knockedout_at as Date).getTime();
        // Shift if their time is <= our new time (they would end up before or at same position)
        return pTime <= newKnockedoutAt.getTime();
      });
    }

    // Shift conflicting players forward by 1 second each, in reverse order
    // to avoid collisions (shift the last one first)
    if (playersToShift.length > 0) {
      // Sort by current position descending (shift last ones first)
      const sortedToShift = [...playersToShift].sort((a, b) => {
        const timeA = new Date(a.knockedout_at as Date).getTime();
        const timeB = new Date(b.knockedout_at as Date).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return Number(b.id) - Number(a.id);
      });

      // Calculate new times: each player gets shifted 1 second after the previous
      // The first player to shift gets newKnockedoutAt + 1s, next gets +2s, etc.
      for (let i = 0; i < sortedToShift.length; i++) {
        const player = sortedToShift[sortedToShift.length - 1 - i]; // Process in forward order for time assignment
        const shiftedTime = new Date(newKnockedoutAt.getTime() + (i + 1) * 1000);

        await prisma.$executeRaw`
          UPDATE tournament_draft_players
          SET knockedout_at = ${shiftedTime},
              updated_at = NOW()
          WHERE id = ${player.id}
        `;
      }
    }

    // Update the moving player's knockedout_at
    await prisma.$executeRaw`
      UPDATE tournament_draft_players
      SET knockedout_at = ${newKnockedoutAt},
          updated_at = NOW()
      WHERE id = ${playerId} AND tournament_draft_id = ${draftId}
    `;

    // Now recalculate ko_positions for all knocked out players
    const updatedKnockedOutPlayers = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, knockedout_at
      FROM tournament_draft_players
      WHERE tournament_draft_id = ${draftId}
        AND knockedout_at IS NOT NULL
      ORDER BY knockedout_at ASC, id ASC
    `;

    // Update each player's ko_position based on their new order
    for (let i = 0; i < updatedKnockedOutPlayers.length; i++) {
      const player = updatedKnockedOutPlayers[i];
      const newKoPosition = i + 1;
      await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET ko_position = ${newKoPosition}
        WHERE id = ${player.id}
      `;
    }

    // Fetch and emit the updated player data
    const updatedPlayerResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_draft_players WHERE id = ${playerId}
    `;

    if (updatedPlayerResult.length > 0) {
      const updatedPlayer = updatedPlayerResult[0];
      emitPlayerJoined(draftId, {
        id: Number(updatedPlayer.id),
        player_name: String(updatedPlayer.player_name || ""),
        player_uid: updatedPlayer.player_uid ? String(updatedPlayer.player_uid) : null,
        player_nickname: updatedPlayer.player_nickname ? String(updatedPlayer.player_nickname) : null,
        ...updatedPlayer,
      });
    }

    return NextResponse.json({
      success: true,
      shiftedCount: playersToShift.length
    });
  } catch (error) {
    console.error("Error moving knockout:", error);
    return NextResponse.json(
      {
        error: "Failed to move knockout",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
