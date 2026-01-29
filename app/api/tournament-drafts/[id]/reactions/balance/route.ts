// app/api/tournament-drafts/[id]/reactions/balance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { SuitCounts, ReactionType } from "@/types";

const VALID_REACTIONS: ReactionType[] = ['heart', 'diamond', 'club', 'spade'];
const MAX_PER_SUIT = 13;

// GET - Fetch user's remaining reaction balance for this tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json({ error: "Invalid tournament ID" }, { status: 400 });
    }

    const usageResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT reaction_type, COALESCE(SUM(count), 0) as total_used
      FROM feed_item_reactions
      WHERE tournament_draft_id = ${tournamentId}
        AND user_uid = ${session.user.uid}
      GROUP BY reaction_type
    `;

    const balance: SuitCounts = {
      heart: MAX_PER_SUIT,
      diamond: MAX_PER_SUIT,
      club: MAX_PER_SUIT,
      spade: MAX_PER_SUIT,
    };

    for (const row of usageResult) {
      const rt = String(row.reaction_type) as ReactionType;
      if (VALID_REACTIONS.includes(rt)) {
        balance[rt] = MAX_PER_SUIT - Number(row.total_used);
      }
    }

    return NextResponse.json(balance);
  } catch (error) {
    console.error("Error fetching reaction balance:", error);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
