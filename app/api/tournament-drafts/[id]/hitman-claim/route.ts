// app/api/tournament-drafts/[id]/hitman-claim/route.ts
// POST - Submit a hitman claim for a knockout
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";
import { sendToPlayerByUid } from "@/lib/push/sendPush";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { knockout_player_id } = body;

    if (!knockout_player_id || typeof knockout_player_id !== "number") {
      return NextResponse.json(
        { error: "knockout_player_id is required" },
        { status: 400 }
      );
    }

    // Verify tournament exists and is in progress, get league_id and TD for role check and notifications
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, status, league_id, tournament_director_uid FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    if (tournament[0].status !== "in_progress") {
      return NextResponse.json(
        { error: "Cannot submit claims for a tournament that is not in progress" },
        { status: 400 }
      );
    }

    // Check if user is a player in this tournament
    const claimerPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, player_name, player_nickname
      FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentId}
        AND player_uid = ${session.user.uid}
      LIMIT 1
    `;

    // Allow admins to claim on behalf of players (for testing or assistance)
    const leagueId = Number(tournament[0].league_id);
    const role = await getLeagueRole(session.user.uid, leagueId);
    const hasAdminAccess = canAccessAdmin(role);

    if (!claimerPlayer.length && !hasAdminAccess) {
      return NextResponse.json(
        { error: "You must be a player in this tournament to submit claims" },
        { status: 403 }
      );
    }

    // Use player name if found, otherwise use session name for admins
    const claimerName = claimerPlayer.length
      ? (claimerPlayer[0].player_nickname
          ? String(claimerPlayer[0].player_nickname)
          : String(claimerPlayer[0].player_name))
      : (session.user.name || session.user.nickname || "Admin");

    // Get the knocked out player and verify it's a valid target
    const knockedOutPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        id,
        player_name,
        player_nickname,
        hitman_name,
        hitman_uid,
        hitman_claim_status,
        status
      FROM tournament_draft_players
      WHERE id = ${knockout_player_id}
        AND tournament_draft_id = ${tournamentId}
      LIMIT 1
    `;

    if (!knockedOutPlayer.length) {
      return NextResponse.json(
        { error: "Player not found in this tournament" },
        { status: 404 }
      );
    }

    const victim = knockedOutPlayer[0];

    // Must be knocked out
    if (victim.status !== "knockedout") {
      return NextResponse.json(
        { error: "This player has not been knocked out yet" },
        { status: 400 }
      );
    }

    // Cannot claim if hitman is already assigned
    // "unknown" doesn't count as having a hitman - it means TD didn't know who knocked them out
    const hasRealHitman = victim.hitman_uid || (victim.hitman_name && victim.hitman_name !== "unknown");
    if (hasRealHitman) {
      return NextResponse.json(
        { error: "Hitman is already assigned for this knockout" },
        { status: 400 }
      );
    }

    // Cannot claim if there's already a pending claim
    if (victim.hitman_claim_status === "pending") {
      return NextResponse.json(
        { error: "There is already a pending claim for this knockout" },
        { status: 400 }
      );
    }

    // Cannot claim if already approved (hitman is assigned)
    // Rejected claims CAN be re-claimed by anyone
    if (victim.hitman_claim_status === "approved") {
      return NextResponse.json(
        { error: "A claim has already been approved for this knockout" },
        { status: 400 }
      );
    }

    // Cannot claim yourself (only applies to players, not admins)
    if (claimerPlayer.length) {
      const victimId = Number(victim.id);
      const claimerId = Number(claimerPlayer[0].id);
      if (victimId === claimerId) {
        return NextResponse.json(
          { error: "You cannot claim your own knockout" },
          { status: 400 }
        );
      }
    }

    // Submit the claim
    await prisma.$executeRaw`
      UPDATE tournament_draft_players
      SET
        hitman_claim_uid = ${session.user.uid},
        hitman_claim_name = ${claimerName},
        hitman_claim_status = 'pending',
        hitman_claimed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${knockout_player_id}
    `;

    // Broadcast the claim update
    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastHitmanClaimUpdate(tournamentId, {
        knockout_player_id,
        claim_status: "pending",
        claimer_uid: session.user.uid,
        claimer_name: claimerName,
      });
    } catch (broadcastError) {
      console.error("Failed to broadcast hitman claim:", broadcastError);
    }

    // Send push notification to tournament director
    const tdUid = tournament[0].tournament_director_uid;
    if (tdUid) {
      const victimName = victim.player_nickname
        ? String(victim.player_nickname)
        : String(victim.player_name);
      try {
        await sendToPlayerByUid(String(tdUid), leagueId, {
          title: "Knockout Claim",
          body: `${claimerName} claimed knockout of ${victimName}`,
          url: `/td/${tournamentId}`,
        });
      } catch (pushError) {
        console.error("Failed to send push notification to TD:", pushError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully",
      claim: {
        knockout_player_id,
        claimer_name: claimerName,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Error submitting hitman claim:", error);
    return NextResponse.json(
      { error: "Failed to submit claim" },
      { status: 500 }
    );
  }
}
