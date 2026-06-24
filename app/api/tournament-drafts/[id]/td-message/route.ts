// app/api/tournament-drafts/[id]/td-message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { createTDMessageFeedItem } from "@/lib/feed/feedService";
import { requireDraftAdmin } from "@/lib/auth-utils";
import { sendToCheckedInPlayers } from "@/lib/push/sendPush";

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

    // Verify user is admin for this draft's league
    const auth = await requireDraftAdmin(tournamentId);
    if (auth.error) return auth.error;

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

    // Verify tournament exists and is in progress, get info for push notification
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT td.id, td.status, l.slug as league_slug, l.league_settings, v.image_sm as venue_image
      FROM tournament_drafts td
      LEFT JOIN leagues l ON td.league_id = l.id
      LEFT JOIN venues v ON td.venue_id = v.id
      WHERE td.id = ${tournamentId}
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

    // Send push notification to checked-in players (fire and forget)
    const leagueSlug = tournament[0].league_slug as string | null;

    if (leagueSlug) {
      // Determine icon URL: prefer venue image, fall back to league icon
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://openbarleague.com';
      let iconUrl = `${baseUrl}/icons/default-icon-512.png`;

      // First, check if venue has an image
      const venueImage = tournament[0].venue_image as string | null;
      if (venueImage) {
        iconUrl = `${baseUrl}/images/venues/${venueImage}`;
      } else {
        // Fall back to league icon from settings
        try {
          const leagueSettings = tournament[0].league_settings as string | null;
          if (leagueSettings) {
            const config = JSON.parse(leagueSettings);
            if (config?.pwa?.logoUrl) {
              const logoPath = config.pwa.logoUrl;
              iconUrl = logoPath.startsWith('http') ? logoPath : `${baseUrl}${logoPath}`;
            }
          }
        } catch (e) {
          console.error('[push] Failed to parse league settings for icon:', e);
        }
      }

      // Truncate message for notification body if needed
      const notificationBody = trimmedMessage.length > 100
        ? trimmedMessage.substring(0, 97) + '...'
        : trimmedMessage;

      // Use tournament ID in URL (not check_in_token) since gameview expects numeric ID
      sendToCheckedInPlayers(tournamentId, {
        title: '📢 TD Message',
        body: notificationBody,
        url: `/l/${leagueSlug}/gameview/${tournamentId}`,
        icon: iconUrl,
      }).catch((err) => console.error('[push] TD message notification failed:', err));
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
