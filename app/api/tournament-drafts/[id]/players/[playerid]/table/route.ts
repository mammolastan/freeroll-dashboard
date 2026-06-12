// app/api/tournament-drafts/[id]/players/[playerid]/table/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RealtimeAPI } from "@/lib/realtime";
import { logAuditEvent, getClientIP, getAdminScreen, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";
import { requireDraftAdmin } from "@/lib/auth-utils";

/**
 * PATCH /api/tournament-drafts/[id]/players/[playerid]/table
 * Reassigns a player to a different table (called on drag-and-drop).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerid: string }> }
) {
  try {
    const { id, playerid } = await params;
    const draftId = parseInt(id);
    const playerId = parseInt(playerid);

    // Verify user is admin for this draft's league
    const auth = await requireDraftAdmin(draftId);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { t_assign } = body;

    // Validate input
    if (!t_assign || t_assign < 1) {
      return NextResponse.json(
        { error: "Invalid table assignment. Must be a positive integer." },
        { status: 400 }
      );
    }

    // Get current player data for audit logging
    const currentPlayer = await prisma.tournamentDraftPlayer.findUnique({
      where: { id: playerId },
      select: { player_name: true, t_assign: true, tournament_draft_id: true }
    });

    if (!currentPlayer) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Verify player belongs to this tournament
    if (currentPlayer.tournament_draft_id !== draftId) {
      return NextResponse.json(
        { error: "Player does not belong to this tournament" },
        { status: 400 }
      );
    }

    const previousTable = currentPlayer.t_assign;

    // Update the player's table assignment
    await prisma.tournamentDraftPlayer.update({
      where: { id: playerId },
      data: { t_assign }
    });

    // Audit logging
    try {
      const session = await getAuditSession();
      const actor = getActorFromSession(session);
      await logAuditEvent({
        tournamentId: draftId,
        actionType: 'TABLE_ASSIGNED',
        actionCategory: 'ADMIN',
        actorId: null,
        actorName: actor.actorName,
        targetPlayerId: playerId,
        targetPlayerName: currentPlayer.player_name,
        previousValue: { t_assign: previousTable },
        newValue: { t_assign },
        metadata: withActorMetadata(actor, {
          fromTable: previousTable,
          toTable: t_assign,
          adminScreen: getAdminScreen(request),
        }),
        ipAddress: getClientIP(request),
      });
    } catch (auditError) {
      console.error('Audit logging failed:', auditError);
    }

    // Emit Socket.IO event for real-time updates
    try {
      await RealtimeAPI.playerUpdated(draftId, playerId);
    } catch (socketError) {
      console.error('Socket broadcast failed:', socketError);
    }

    return NextResponse.json({
      success: true,
      playerId,
      t_assign,
      previousTable
    });
  } catch (error) {
    console.error("Error reassigning player table:", error);
    return NextResponse.json(
      { error: "Failed to reassign player to table" },
      { status: 500 }
    );
  }
}
