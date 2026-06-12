// app/api/tournament-drafts/[id]/players/reset-tables/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RealtimeAPI } from "@/lib/realtime";
import { logAuditEvent, getClientIP, getAdminScreen, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";
import { requireDraftAdmin } from "@/lib/auth-utils";

/**
 * POST /api/tournament-drafts/[id]/players/reset-tables
 * Resets all player table assignments to 0 (unassigned).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const draftId = parseInt(id);

    // Verify user is admin for this draft's league
    const auth = await requireDraftAdmin(draftId);
    if (auth.error) return auth.error;

    // Verify the tournament exists
    const tournament = await prisma.tournamentDraft.findUnique({
      where: { id: draftId },
      select: { id: true, title: true }
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Get count of players that will be affected
    const playersWithAssignments = await prisma.tournamentDraftPlayer.count({
      where: {
        tournament_draft_id: draftId,
        t_assign: { gt: 0 }
      }
    });

    // Reset all table assignments to 0
    await prisma.tournamentDraftPlayer.updateMany({
      where: { tournament_draft_id: draftId },
      data: { t_assign: 0 }
    });

    // Audit logging
    try {
      const session = await getAuditSession();
      const actor = getActorFromSession(session);
      await logAuditEvent({
        tournamentId: draftId,
        actionType: 'TABLE_RESET',
        actionCategory: 'ADMIN',
        actorId: null,
        actorName: actor.actorName,
        targetPlayerId: null,
        targetPlayerName: null,
        previousValue: { playersAffected: playersWithAssignments },
        newValue: { t_assign: 0 },
        metadata: withActorMetadata(actor, {
          playersReset: playersWithAssignments,
          adminScreen: getAdminScreen(request),
        }),
        ipAddress: getClientIP(request),
      });
    } catch (auditError) {
      console.error('Audit logging failed:', auditError);
    }

    // Emit Socket.IO event for real-time updates
    try {
      await RealtimeAPI.tournamentUpdated(draftId);
    } catch (socketError) {
      console.error('Socket broadcast failed:', socketError);
    }

    return NextResponse.json({
      success: true,
      playersReset: playersWithAssignments
    });
  } catch (error) {
    console.error("Error resetting table assignments:", error);
    return NextResponse.json(
      { error: "Failed to reset table assignments" },
      { status: 500 }
    );
  }
}
