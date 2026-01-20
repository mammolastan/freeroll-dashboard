// app/api/tournament-drafts/[id]/td-message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { createTDMessageFeedItem } from "@/lib/feed/feedService";

// POST - Post a TD message to the tournament feed (admin only)
export async function POST(
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

    // Parse request body
    const body = await request.json();
    const { message } = body;

    // Validate message
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedMessage.length > 500) {
      return NextResponse.json(
        { error: "Message cannot exceed 500 characters" },
        { status: 400 }
      );
    }

    // Verify tournament exists and is in progress
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, status FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    if (tournament[0].status !== "in_progress") {
      return NextResponse.json(
        { error: "Cannot post to a tournament that is not in progress" },
        { status: 400 }
      );
    }

    // Create the TD message feed item
    const feedItem = await createTDMessageFeedItem(tournamentId, trimmedMessage);

    if (!feedItem) {
      return NextResponse.json(
        { error: "Failed to create TD message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: feedItem });
  } catch (error) {
    console.error("Error posting TD message:", error);
    return NextResponse.json(
      { error: "Failed to post TD message" },
      { status: 500 }
    );
  }
}
