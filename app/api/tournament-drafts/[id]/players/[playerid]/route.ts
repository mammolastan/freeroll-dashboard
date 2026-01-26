// app/api/tournament-drafts/[id]/players/[playerid]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { emitPlayerJoined } from "@/lib/socketServer";
import { createKnockoutFeedItem } from "@/lib/feed/feedService";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerid: string }> }
) {
  try {
    const { id, playerid } = await params;
    const body = await request.json();
    const playerId = parseInt(playerid);
    const draftId = parseInt(id);
    const { player_name, hitman_name, ko_position, placement } = body;

    console.log("Updating player:", playerId, "with data:", {
      player_name,
      hitman_name,
      ko_position,
      placement,
    });

    // FIRST: Get the current player state to detect knockout
    const currentPlayerResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT player_name, player_nickname, player_uid, ko_position, hitman_name
      FROM tournament_draft_players
      WHERE id = ${playerId}
    `;

    const currentPlayer = currentPlayerResult.length > 0 ? currentPlayerResult[0] : null;

    // Determine if this is a knockout or undo
    const isKnockout = ko_position !== null && ko_position !== undefined && typeof ko_position === 'number';
    const isUndoKnockout = currentPlayer && currentPlayer.ko_position !== null && (ko_position === null || ko_position === undefined);

    // Look up hitman's UID if this is a knockout with a hitman
    let hitmanUid: string | null = null;
    if (isKnockout && hitman_name) {
      const hitmanPlayer = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT player_uid
        FROM tournament_draft_players
        WHERE tournament_draft_id = ${draftId} AND player_name = ${hitman_name}
        LIMIT 1
      `;
      if (hitmanPlayer.length > 0 && hitmanPlayer[0].player_uid) {
        hitmanUid = String(hitmanPlayer[0].player_uid);
      }
    }

    // Build the update query based on knockout state
    let updateResult: number;
    if (isKnockout) {
      // Setting knockout - update status, hitman_uid, and knockedout_at
      updateResult = await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          player_name = ${player_name || ""},
          hitman_name = ${hitman_name || null},
          hitman_uid = ${hitmanUid},
          ko_position = ${ko_position || null},
          placement = ${placement || null},
          status = 'knockedout',
          knockedout_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR),
          updated_at = NOW()
        WHERE id = ${playerId}
      `;
    } else if (isUndoKnockout) {
      // Undoing knockout - reset status and clear knockout fields
      updateResult = await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          player_name = ${player_name || ""},
          hitman_name = ${hitman_name || null},
          hitman_uid = NULL,
          ko_position = ${ko_position || null},
          placement = ${placement || null},
          status = 'active',
          knockedout_at = NULL,
          updated_at = NOW()
        WHERE id = ${playerId}
      `;
    } else {
      // Normal update without knockout change
      updateResult = await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          player_name = ${player_name || ""},
          hitman_name = ${hitman_name || null},
          ko_position = ${ko_position || null},
          placement = ${placement || null},
          updated_at = NOW()
        WHERE id = ${playerId}
      `;
    }

    console.log("Update result:", updateResult);

    if (updateResult === 1) {
      // Fetch the complete updated record
      const updatedPlayerResult = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT * FROM tournament_draft_players WHERE id = ${playerId}
      `;

      const updatedPlayer = updatedPlayerResult[0];

      // Emit Socket.IO event for real-time updates
      // Cast to the expected PlayerData type (has index signature for extra fields)
      emitPlayerJoined(draftId, {
        id: Number(updatedPlayer.id),
        player_name: String(updatedPlayer.player_name || ""),
        player_uid: updatedPlayer.player_uid ? String(updatedPlayer.player_uid) : null,
        player_nickname: updatedPlayer.player_nickname ? String(updatedPlayer.player_nickname) : null,
        ...updatedPlayer,
      });

      // DETECT KNOCKOUT: ko_position went from null to a number
      const wasKnockedOut =
        currentPlayer &&
        currentPlayer.ko_position === null &&
        ko_position !== null &&
        ko_position !== undefined &&
        typeof ko_position === 'number';

      if (wasKnockedOut) {
        // Create feed item for the knockout
        try {
          // Use nickname for eliminated player if available
          const eliminatedPlayerName = String(
            currentPlayer.player_nickname || currentPlayer.player_name || player_name
          );

          // Look up hitman's nickname if hitman exists
          let hitmanDisplayName = hitman_name || null;
          if (hitman_name) {
            const hitmanPlayer = await prisma.$queryRaw<RawQueryResult[]>`
              SELECT player_nickname
              FROM tournament_draft_players
              WHERE tournament_draft_id = ${draftId} AND player_name = ${hitman_name}
              LIMIT 1
            `;
            if (hitmanPlayer.length > 0 && hitmanPlayer[0].player_nickname) {
              hitmanDisplayName = String(hitmanPlayer[0].player_nickname);
            }
          }

          await createKnockoutFeedItem(
            draftId,
            eliminatedPlayerName,
            hitmanDisplayName,
            ko_position,
            currentPlayer.player_uid ? String(currentPlayer.player_uid) : null
          );
        } catch (feedError) {
          // Log but don't fail the request if feed creation fails
          console.error("Failed to create knockout feed item:", feedError);
        }
      }

      return NextResponse.json(updatedPlayer);
    } else {
      return NextResponse.json(
        { error: "Player not found or update failed" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error updating draft player:", error);
    return NextResponse.json(
      {
        error: "Failed to update player",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; playerid: string }> }
) {
  try {
    const { id, playerid } = await params;
    const playerId = parseInt(playerid);

    const deleteResult = await prisma.$executeRaw`
      DELETE FROM tournament_draft_players WHERE id = ${playerId}
    `;

    if (deleteResult === 1) {
      // Emit Socket.IO event for real-time updates
      const draftId = parseInt(id);
      emitPlayerJoined(draftId, { deleted: true, playerId });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error deleting draft player:", error);
    return NextResponse.json(
      { error: "Failed to delete player" },
      { status: 500 }
    );
  }
}
