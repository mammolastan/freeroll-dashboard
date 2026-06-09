// app/api/tournament-drafts/[id]/hitman-claims/route.ts
// GET - Get all pending hitman claims for a tournament (TD only)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

interface PendingClaim {
  knockout_player_id: number;
  eliminated_player_name: string;
  eliminated_player_uid: string | null;
  ko_position: number | null;
  knockedout_at: string;
  claimer_uid: string;
  claimer_name: string;
  claimed_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Verify tournament exists
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Get all pending claims
    const pendingClaims = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        id as knockout_player_id,
        player_name,
        player_nickname,
        player_uid,
        ko_position,
        knockedout_at,
        hitman_claim_uid,
        hitman_claim_name,
        hitman_claimed_at
      FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentId}
        AND hitman_claim_status = 'pending'
      ORDER BY hitman_claimed_at ASC
    `;

    const claims: PendingClaim[] = pendingClaims.map((row) => ({
      knockout_player_id: Number(row.knockout_player_id),
      eliminated_player_name: row.player_nickname
        ? String(row.player_nickname)
        : String(row.player_name),
      eliminated_player_uid: row.player_uid ? String(row.player_uid) : null,
      ko_position: row.ko_position ? Number(row.ko_position) : null,
      knockedout_at:
        row.knockedout_at instanceof Date
          ? row.knockedout_at.toISOString()
          : String(row.knockedout_at),
      claimer_uid: String(row.hitman_claim_uid),
      claimer_name: String(row.hitman_claim_name),
      claimed_at:
        row.hitman_claimed_at instanceof Date
          ? row.hitman_claimed_at.toISOString()
          : String(row.hitman_claimed_at),
    }));

    return NextResponse.json({ claims });
  } catch (error) {
    console.error("Error fetching hitman claims:", error);
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    );
  }
}
