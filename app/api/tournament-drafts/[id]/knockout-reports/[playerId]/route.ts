// app/api/tournament-drafts/[id]/knockout-reports/[playerId]/route.ts
// PUT - Approve or reject a knockout report (TD only)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";
import { PlayerEvents } from "@/lib/realtime/events/playerEvents";
import { requireDraftAdmin } from "@/lib/auth-utils";
import { recalculateKoPositions } from "@/lib/tournament/koUtils";
import { broadcastKnockoutEvent } from "@/lib/feed/feedService";
import { sendToPlayerByUid } from "@/lib/push/sendPush";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await params;
    const tournamentId = parseInt(id);
    const victimPlayerId = parseInt(playerId);

    if (isNaN(tournamentId) || isNaN(victimPlayerId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID or player ID" },
        { status: 400 }
      );
    }

    // Verify user is admin for this draft's league
    const auth = await requireDraftAdmin(tournamentId);
    if (auth.error) return auth.error;

    const session = await getServerSession(authOptions);
    const reviewerName = session?.user?.name || session?.user?.nickname || "TD";

    // Parse request body
    const body = await request.json();
    const { action } = body;

    if (!action || (action !== "approve" && action !== "reject")) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Verify tournament exists and get league_id
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, status, league_id
      FROM tournament_drafts
      WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    const leagueId = Number(tournament[0].league_id);

    // Get the player with pending report
    const player = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        id,
        player_name,
        player_nickname,
        player_uid,
        ko_report_status,
        ko_report_hitman_uid,
        ko_reporter_uid
      FROM tournament_draft_players
      WHERE id = ${victimPlayerId}
        AND tournament_draft_id = ${tournamentId}
      LIMIT 1
    `;

    if (!player.length) {
      return NextResponse.json(
        { error: "Player not found in this tournament" },
        { status: 404 }
      );
    }

    const victim = player[0];
    const victimName = victim.player_nickname
      ? String(victim.player_nickname)
      : String(victim.player_name);

    // Must have a pending report
    if (victim.ko_report_status !== "pending") {
      return NextResponse.json(
        { error: "No pending knockout report found for this player" },
        { status: 400 }
      );
    }

    const hitmanUid = victim.ko_report_hitman_uid
      ? String(victim.ko_report_hitman_uid)
      : null;
    const reporterUid = victim.ko_reporter_uid
      ? String(victim.ko_reporter_uid)
      : null;

    // Look up hitman name for display
    let hitmanName: string | null = null;
    if (hitmanUid) {
      const hitmanPlayer = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT player_name, player_nickname
        FROM tournament_draft_players
        WHERE tournament_draft_id = ${tournamentId}
          AND player_uid = ${hitmanUid}
        LIMIT 1
      `;
      if (hitmanPlayer.length) {
        hitmanName = hitmanPlayer[0].player_nickname
          ? String(hitmanPlayer[0].player_nickname)
          : String(hitmanPlayer[0].player_name);
      }
    }

    if (action === "approve") {
      // Approve: Eliminate the victim and assign the hitman
      await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          status = 'knockedout',
          knockedout_at = NOW(),
          hitman_uid = ko_report_hitman_uid,
          hitman_name = ${hitmanName},
          ko_report_status = 'approved',
          ko_report_reviewed_at = NOW(),
          ko_report_reviewed_by = ${reviewerName},
          updated_at = NOW()
        WHERE id = ${victimPlayerId}
      `;

      // Recalculate ko_positions for all knocked out players
      await recalculateKoPositions(tournamentId, prisma);

      // Get the updated player for broadcast
      const updatedPlayer = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT ko_position, knockedout_at
        FROM tournament_draft_players
        WHERE id = ${victimPlayerId}
      `;

      const koPosition = updatedPlayer[0]?.ko_position
        ? Number(updatedPlayer[0].ko_position)
        : null;
      const knockedoutAt = updatedPlayer[0]?.knockedout_at instanceof Date
        ? updatedPlayer[0].knockedout_at.toISOString()
        : String(updatedPlayer[0]?.knockedout_at || new Date().toISOString());

      // Broadcast knockout event to feed
      if (koPosition) {
        try {
          broadcastKnockoutEvent(
            tournamentId,
            victimPlayerId,
            victimName,
            hitmanName,
            koPosition,
            knockedoutAt
          );
        } catch (broadcastError) {
          console.error("Failed to broadcast knockout event:", broadcastError);
        }
      }

      // Send push notification to reporter (if different from TD)
      if (reporterUid && reporterUid !== session?.user?.uid) {
        try {
          await sendToPlayerByUid(reporterUid, leagueId, {
            title: "Report Approved",
            body: `Your knockout report for ${victimName} was approved`,
            url: `/tournament/${tournamentId}`,
          });
        } catch (pushError) {
          console.error("Failed to send push notification to reporter:", pushError);
        }
      }

      // Send push notification to hitman (if different from reporter and TD)
      if (hitmanUid && hitmanUid !== reporterUid && hitmanUid !== session?.user?.uid) {
        try {
          await sendToPlayerByUid(hitmanUid, leagueId, {
            title: "Knockout Credit",
            body: `You've been credited with the knockout of ${victimName}`,
            url: `/tournament/${tournamentId}`,
          });
        } catch (pushError) {
          console.error("Failed to send push notification to hitman:", pushError);
        }
      }
    } else {
      // Reject: Just update status and clear report fields
      await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          ko_report_status = 'rejected',
          ko_report_reviewed_at = NOW(),
          ko_report_reviewed_by = ${reviewerName},
          ko_report_hitman_uid = NULL,
          ko_reporter_uid = NULL,
          ko_reported_at = NULL,
          updated_at = NOW()
        WHERE id = ${victimPlayerId}
      `;

      // Send push notification to reporter
      if (reporterUid && reporterUid !== session?.user?.uid) {
        try {
          await sendToPlayerByUid(reporterUid, leagueId, {
            title: "Report Rejected",
            body: `Your knockout report for ${victimName} was rejected`,
            url: `/tournament/${tournamentId}`,
          });
        } catch (pushError) {
          console.error("Failed to send push notification to reporter:", pushError);
        }
      }
    }

    // Broadcast the report status update
    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastKnockoutReportUpdate(tournamentId, {
        victim_player_id: victimPlayerId,
        report_status: action === "approve" ? "approved" : "rejected",
        hitman_uid: hitmanUid,
        hitman_name: hitmanName,
        reporter_uid: reporterUid,
        reviewed_by: reviewerName,
      });

      // Also broadcast players:updated so all clients see the knockout
      await PlayerEvents.handlePlayerUpdated(tournamentId, victimPlayerId);
    } catch (broadcastError) {
      console.error("Failed to broadcast knockout report update:", broadcastError);
    }

    return NextResponse.json({
      success: true,
      message: `Knockout report ${action}d successfully`,
      result: {
        victim_player_id: victimPlayerId,
        action,
        reviewed_by: reviewerName,
      },
    });
  } catch (error) {
    console.error("Error reviewing knockout report:", error);
    return NextResponse.json(
      { error: "Failed to review knockout report" },
      { status: 500 }
    );
  }
}
