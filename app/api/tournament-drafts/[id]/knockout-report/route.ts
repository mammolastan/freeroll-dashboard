// app/api/tournament-drafts/[id]/knockout-report/route.ts
// POST - Submit a knockout report (player reports another player was knocked out)
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
    const { victim_player_id, hitman_player_id } = body;

    if (!victim_player_id || typeof victim_player_id !== "number") {
      return NextResponse.json(
        { error: "victim_player_id is required" },
        { status: 400 }
      );
    }

    if (!hitman_player_id || typeof hitman_player_id !== "number") {
      return NextResponse.json(
        { error: "hitman_player_id is required" },
        { status: 400 }
      );
    }

    // Victim and hitman must be different
    if (victim_player_id === hitman_player_id) {
      return NextResponse.json(
        { error: "Victim and hitman must be different players" },
        { status: 400 }
      );
    }

    // Verify tournament exists and is in progress
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, status, league_id, tournament_director_uid
      FROM tournament_drafts
      WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    if (tournament[0].status !== "in_progress") {
      return NextResponse.json(
        { error: "Cannot submit reports for a tournament that is not in progress" },
        { status: 400 }
      );
    }

    const leagueId = Number(tournament[0].league_id);

    // Check if user is a player in this tournament or an admin
    const reporterPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, player_name, player_nickname, player_uid
      FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentId}
        AND player_uid = ${session.user.uid}
      LIMIT 1
    `;

    const role = await getLeagueRole(session.user.uid, leagueId);
    const hasAdminAccess = canAccessAdmin(role);

    if (!reporterPlayer.length && !hasAdminAccess) {
      return NextResponse.json(
        { error: "You must be a player in this tournament to submit reports" },
        { status: 403 }
      );
    }

    // Get the victim player and verify they're active
    const victimPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        id,
        player_name,
        player_nickname,
        player_uid,
        status,
        ko_report_status
      FROM tournament_draft_players
      WHERE id = ${victim_player_id}
        AND tournament_draft_id = ${tournamentId}
      LIMIT 1
    `;

    if (!victimPlayer.length) {
      return NextResponse.json(
        { error: "Victim player not found in this tournament" },
        { status: 404 }
      );
    }

    const victim = victimPlayer[0];

    // Victim must be active (not already knocked out)
    if (victim.status !== "active") {
      return NextResponse.json(
        { error: "This player has already been knocked out" },
        { status: 400 }
      );
    }

    // Cannot have a pending report for this victim
    if (victim.ko_report_status === "pending") {
      return NextResponse.json(
        { error: "There is already a pending knockout report for this player" },
        { status: 400 }
      );
    }

    // Get the hitman player and verify they exist
    const hitmanPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        id,
        player_name,
        player_nickname,
        player_uid
      FROM tournament_draft_players
      WHERE id = ${hitman_player_id}
        AND tournament_draft_id = ${tournamentId}
      LIMIT 1
    `;

    if (!hitmanPlayer.length) {
      return NextResponse.json(
        { error: "Hitman player not found in this tournament" },
        { status: 404 }
      );
    }

    const hitman = hitmanPlayer[0];
    const hitmanUid = hitman.player_uid ? String(hitman.player_uid) : null;

    // Submit the knockout report
    await prisma.$executeRaw`
      UPDATE tournament_draft_players
      SET
        ko_report_status = 'pending',
        ko_report_hitman_uid = ${hitmanUid},
        ko_reporter_uid = ${session.user.uid},
        ko_reported_at = NOW(),
        updated_at = NOW()
      WHERE id = ${victim_player_id}
    `;

    // Get display names for notifications
    const victimName = victim.player_nickname
      ? String(victim.player_nickname)
      : String(victim.player_name);
    const hitmanName = hitman.player_nickname
      ? String(hitman.player_nickname)
      : String(hitman.player_name);
    const reporterName = reporterPlayer.length
      ? (reporterPlayer[0].player_nickname
          ? String(reporterPlayer[0].player_nickname)
          : String(reporterPlayer[0].player_name))
      : (session.user.name || session.user.nickname || "Admin");

    // Broadcast the report update
    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastKnockoutReportUpdate(tournamentId, {
        victim_player_id,
        report_status: "pending",
        hitman_uid: hitmanUid,
        hitman_name: hitmanName,
        reporter_uid: session.user.uid,
        reporter_name: reporterName,
      });
    } catch (broadcastError) {
      console.error("Failed to broadcast knockout report:", broadcastError);
    }

    // Send push notification to tournament director
    const tdUid = tournament[0].tournament_director_uid;
    if (tdUid) {
      try {
        await sendToPlayerByUid(String(tdUid), leagueId, {
          title: "Knockout Report",
          body: `${reporterName} reports: ${hitmanName} KO'd ${victimName}`,
          url: `/td/${tournamentId}`,
        });
      } catch (pushError) {
        console.error("Failed to send push notification to TD:", pushError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Knockout report submitted successfully",
      report: {
        victim_player_id,
        victim_name: victimName,
        hitman_player_id,
        hitman_name: hitmanName,
        reporter_name: reporterName,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Error submitting knockout report:", error);
    return NextResponse.json(
      { error: "Failed to submit knockout report" },
      { status: 500 }
    );
  }
}
