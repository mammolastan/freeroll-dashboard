// app/api/tournament-drafts/[id]/feed/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

// DELETE - Delete a feed item (admin only, only message and td_message types)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const tournamentId = parseInt(id);
    const feedItemId = parseInt(itemId);

    if (isNaN(tournamentId) || isNaN(feedItemId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID or feed item ID" },
        { status: 400 }
      );
    }

    // Verify the feed item exists and belongs to this tournament
    const feedItem = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, tournament_draft_id, item_type
      FROM tournament_feed_items
      WHERE id = ${feedItemId} AND tournament_draft_id = ${tournamentId}
    `;

    if (!feedItem.length) {
      return NextResponse.json(
        { error: "Feed item not found" },
        { status: 404 }
      );
    }

    // Only allow deletion of message and td_message types
    const itemType = feedItem[0].item_type;
    if (itemType !== 'message' && itemType !== 'td_message') {
      return NextResponse.json(
        { error: "Cannot delete this type of feed item" },
        { status: 403 }
      );
    }

    // Delete the feed item
    await prisma.$executeRaw`
      DELETE FROM tournament_feed_items
      WHERE id = ${feedItemId} AND tournament_draft_id = ${tournamentId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting feed item:", error);
    return NextResponse.json(
      { error: "Failed to delete feed item" },
      { status: 500 }
    );
  }
}
