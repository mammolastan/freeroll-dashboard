// app/api/admin/players/update-nickname/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, getClientIP } from "@/lib/auditlog";
import { requireAdmin } from "@/lib/auth-utils";

export async function POST(request: Request) {
  const adminCheck = await requireAdmin();
  if (adminCheck.error) return adminCheck.error;

  const ipAddress = getClientIP(request);

  try {
    const { uid, nickname } = await request.json();

    // Fetch current player state before updating
    const currentPlayer = await prisma.player.findUnique({
      where: { uid },
    });

    if (!currentPlayer) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const oldNickname = currentPlayer.nickname;

    const updatedPlayer = await prisma.player.update({
      where: { uid },
      data: { nickname },
    });

    // Audit logging - using tournamentId: 0 as sentinel for non-tournament actions
    if (oldNickname !== nickname) {
      try {
        await logAuditEvent({
          tournamentId: 0, // Sentinel value for non-tournament actions
          actionType: "ENTRY_FIELD_UPDATED",
          actionCategory: "ADMIN",
          actorId: null,
          actorName: "Admin",
          targetPlayerId: null, // Player table uses uid (string), not numeric id
          targetPlayerName: currentPlayer.name,
          previousValue: {
            nickname: oldNickname,
          },
          newValue: {
            nickname: nickname,
          },
          metadata: {
            playerTable: true, // Flag that this is a player table change, not tournament entry
            playerUid: uid,
          },
          ipAddress,
        });
      } catch (auditError) {
        console.error("Audit logging failed:", auditError);
        // Don't throw - allow main operation to succeed
      }
    }

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error("Error updating nickname:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
