// app/api/tournament-drafts/[id]/hitman-claims/[playerId]/route.ts
// PUT - Approve or reject a hitman claim (TD only)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";
import { PlayerEvents } from "@/lib/realtime/events/playerEvents";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const reviewerName = session?.user?.name || session?.user?.nickname || "TD";

    const { id, playerId } = await params;
    const tournamentId = parseInt(id);
    const knockoutPlayerId = parseInt(playerId);

    if (isNaN(tournamentId) || isNaN(knockoutPlayerId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID or player ID" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action } = body;

    if (!action || (action !== "approve" && action !== "reject")) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Verify tournament exists
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, status FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Get the player with pending claim
    const player = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        id,
        player_name,
        player_nickname,
        hitman_claim_uid,
        hitman_claim_name,
        hitman_claim_status
      FROM tournament_draft_players
      WHERE id = ${knockoutPlayerId}
        AND tournament_draft_id = ${tournamentId}
      LIMIT 1
    `;

    if (!player.length) {
      return NextResponse.json(
        { error: "Player not found in this tournament" },
        { status: 404 }
      );
    }

    const targetPlayer = player[0];

    // Must have a pending claim
    if (targetPlayer.hitman_claim_status !== "pending") {
      return NextResponse.json(
        { error: "No pending claim found for this player" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      // Approve: Copy claim to official hitman fields
      await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          hitman_uid = hitman_claim_uid,
          hitman_name = hitman_claim_name,
          hitman_claim_status = 'approved',
          hitman_claim_reviewed_at = NOW(),
          hitman_claim_reviewed_by = ${reviewerName},
          updated_at = NOW()
        WHERE id = ${knockoutPlayerId}
      `;
    } else {
      // Reject: Just update status
      await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          hitman_claim_status = 'rejected',
          hitman_claim_reviewed_at = NOW(),
          hitman_claim_reviewed_by = ${reviewerName},
          updated_at = NOW()
        WHERE id = ${knockoutPlayerId}
      `;
    }

    // Broadcast the claim update
    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastHitmanClaimUpdate(tournamentId, {
        knockout_player_id: knockoutPlayerId,
        claim_status: action === "approve" ? "approved" : "rejected",
        claimer_uid: String(targetPlayer.hitman_claim_uid),
        claimer_name: String(targetPlayer.hitman_claim_name),
        reviewed_by: reviewerName,
      });

      // Also broadcast players:updated so TV screens and other clients see the hitman change
      await PlayerEvents.handlePlayerUpdated(tournamentId, knockoutPlayerId);
    } catch (broadcastError) {
      console.error("Failed to broadcast hitman claim update:", broadcastError);
    }

    return NextResponse.json({
      success: true,
      message: `Claim ${action}d successfully`,
      result: {
        knockout_player_id: knockoutPlayerId,
        action,
        reviewed_by: reviewerName,
      },
    });
  } catch (error) {
    console.error("Error reviewing hitman claim:", error);
    return NextResponse.json(
      { error: "Failed to review claim" },
      { status: 500 }
    );
  }
}
