// app/api/tournament-drafts/[id]/feed/[itemId]/reactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { SuitCounts, ReactionType } from "@/types";
import { BroadcastManager } from "@/lib/realtime/broadcastManager";

const VALID_REACTIONS: ReactionType[] = ['heart', 'diamond', 'club', 'spade'];
const MAX_PER_SUIT = 13;

function emptySuitCounts(): SuitCounts {
  return { heart: 0, diamond: 0, club: 0, spade: 0 };
}

// GET - Fetch aggregated reactions for a feed item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json({ error: "Invalid tournament ID" }, { status: 400 });
    }

    // Get aggregated totals for this item
    const totals = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT reaction_type, SUM(count) as total
      FROM feed_item_reactions
      WHERE feed_item_id = ${itemId} AND tournament_draft_id = ${tournamentId}
      GROUP BY reaction_type
    `;

    const suitTotals = emptySuitCounts();
    for (const row of totals) {
      const rt = String(row.reaction_type) as ReactionType;
      if (VALID_REACTIONS.includes(rt)) {
        suitTotals[rt] = Number(row.total);
      }
    }

    // If user is logged in, include their own counts
    const session = await getServerSession(authOptions);
    let mine = emptySuitCounts();

    if (session?.user?.uid) {
      const myRows = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT reaction_type, count
        FROM feed_item_reactions
        WHERE feed_item_id = ${itemId}
          AND tournament_draft_id = ${tournamentId}
          AND user_uid = ${session.user.uid}
      `;

      for (const row of myRows) {
        const rt = String(row.reaction_type) as ReactionType;
        if (VALID_REACTIONS.includes(rt)) {
          mine[rt] = Number(row.count);
        }
      }
    }

    return NextResponse.json({ totals: suitTotals, mine });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }
}

// POST - Add reaction(s) to a feed item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id, itemId } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json({ error: "Invalid tournament ID" }, { status: 400 });
    }

    const body = await request.json();
    const reactionType = body.reaction_type as ReactionType;
    const amount = Math.max(1, Math.min(13, parseInt(body.count) || 1));

    if (!VALID_REACTIONS.includes(reactionType)) {
      return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 });
    }

    const userUid = session.user.uid;

    // Check user's total usage of this suit in this tournament
    const usageResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT COALESCE(SUM(count), 0) as total_used
      FROM feed_item_reactions
      WHERE tournament_draft_id = ${tournamentId}
        AND user_uid = ${userUid}
        AND reaction_type = ${reactionType}
    `;

    const totalUsed = Number(usageResult[0]?.total_used || 0);
    const remaining = MAX_PER_SUIT - totalUsed;

    if (remaining <= 0) {
      // Return the real balance so the client can correct its stale state
      const balanceResult = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT reaction_type, COALESCE(SUM(count), 0) as total_used
        FROM feed_item_reactions
        WHERE tournament_draft_id = ${tournamentId}
          AND user_uid = ${userUid}
        GROUP BY reaction_type
      `;
      const balance = emptySuitCounts();
      for (const key of VALID_REACTIONS) {
        balance[key] = MAX_PER_SUIT;
      }
      for (const row of balanceResult) {
        const rt = String(row.reaction_type) as ReactionType;
        if (VALID_REACTIONS.includes(rt)) {
          balance[rt] = MAX_PER_SUIT - Number(row.total_used);
        }
      }

      return NextResponse.json(
        { error: `You've used all 13 ${reactionType} reactions in this tournament`, balance },
        { status: 400 }
      );
    }

    // Clamp amount to what's remaining
    const actualAmount = Math.min(amount, remaining);

    // Upsert: increment count if exists, otherwise insert
    await prisma.$executeRaw`
      INSERT INTO feed_item_reactions (feed_item_id, tournament_draft_id, user_uid, reaction_type, count)
      VALUES (${itemId}, ${tournamentId}, ${userUid}, ${reactionType}, ${actualAmount})
      ON DUPLICATE KEY UPDATE count = count + ${actualAmount}, updated_at = NOW()
    `;

    // Get updated totals for this item
    const totals = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT reaction_type, SUM(count) as total
      FROM feed_item_reactions
      WHERE feed_item_id = ${itemId} AND tournament_draft_id = ${tournamentId}
      GROUP BY reaction_type
    `;

    const suitTotals = emptySuitCounts();
    for (const row of totals) {
      const rt = String(row.reaction_type) as ReactionType;
      if (VALID_REACTIONS.includes(rt)) {
        suitTotals[rt] = Number(row.total);
      }
    }

    // Get user's updated balance for this suit
    const newUsage = totalUsed + actualAmount;
    const balance = emptySuitCounts();
    const balanceResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT reaction_type, COALESCE(SUM(count), 0) as total_used
      FROM feed_item_reactions
      WHERE tournament_draft_id = ${tournamentId}
        AND user_uid = ${userUid}
      GROUP BY reaction_type
    `;

    for (const key of VALID_REACTIONS) {
      balance[key] = MAX_PER_SUIT;
    }
    for (const row of balanceResult) {
      const rt = String(row.reaction_type) as ReactionType;
      if (VALID_REACTIONS.includes(rt)) {
        balance[rt] = MAX_PER_SUIT - Number(row.total_used);
      }
    }

    // Broadcast reaction update
    try {
      const broadcast = BroadcastManager.getInstance();
      broadcast.broadcastReactionUpdate(tournamentId, itemId, suitTotals);
    } catch (broadcastError) {
      console.error("Failed to broadcast reaction update:", broadcastError);
    }

    return NextResponse.json({
      totals: suitTotals,
      balance,
      added: actualAmount,
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return NextResponse.json({ error: "Failed to add reaction" }, { status: 500 });
  }
}
