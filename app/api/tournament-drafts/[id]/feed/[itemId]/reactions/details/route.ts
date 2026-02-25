// app/api/tournament-drafts/[id]/feed/[itemId]/reactions/details/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

// GET - Fetch per-user reaction breakdown for a feed item
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

    const rows = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        r.user_uid,
        CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
        p.nickname,
        p.photo_url,
        r.reaction_type,
        r.count
      FROM feed_item_reactions r
      LEFT JOIN players_v2 p
        ON r.user_uid COLLATE utf8mb4_unicode_ci = p.uid COLLATE utf8mb4_unicode_ci
      WHERE r.feed_item_id = ${itemId}
        AND r.tournament_draft_id = ${tournamentId}
        AND r.count > 0
      ORDER BY p.name ASC, r.reaction_type ASC
    `;

    const details = rows.map((row) => ({
      user_uid: String(row.user_uid),
      name: row.name ? String(row.name) : null,
      nickname: row.nickname ? String(row.nickname) : null,
      photo_url: row.photo_url ? String(row.photo_url) : null,
      reaction_type: String(row.reaction_type),
      count: Number(row.count),
    }));

    return NextResponse.json({ details });
  } catch (error) {
    console.error("Error fetching reaction details:", error);
    return NextResponse.json({ error: "Failed to fetch reaction details" }, { status: 500 });
  }
}
