import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayName } from "@/lib/playerUtils";
import { revalidatePlayersCache } from "@/lib/players-cache";
import { revalidateRankingsCache } from "@/lib/rankings-cache";

// GET - Fetch current user's profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const player = await prisma.players_v2.findUnique({
      where: { uid: session.user.uid },
      select: {
        uid: true,
        first_name: true,
        last_name: true,
        nickname: true,
        email: true,
        photo_url: true,
        favorite_hand: true,
        favorite_pro: true,
        phone_number: true,
        sms_opt_in: true,
        created: true,
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Return with computed display name for backwards compatibility
    return NextResponse.json({
      ...player,
      name: getDisplayName(player),
      created_at: player.created,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH - Update profile (nickname)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nickname, favorite_hand, favorite_pro, phone_number, sms_opt_in } = await request.json();

    // Validate nickname
    if (nickname !== null && nickname !== undefined) {
      if (typeof nickname !== "string") {
        return NextResponse.json(
          { error: "Invalid nickname" },
          { status: 400 }
        );
      }

      if (nickname.length > 50) {
        return NextResponse.json(
          { error: "Nickname must be 50 characters or less" },
          { status: 400 }
        );
      }
    }

    // Validate favorite_hand
    if (favorite_hand !== null && favorite_hand !== undefined) {
      if (typeof favorite_hand !== "string") {
        return NextResponse.json(
          { error: "Invalid favorite hand" },
          { status: 400 }
        );
      }

      if (favorite_hand.length > 100) {
        return NextResponse.json(
          { error: "Favorite hand must be 100 characters or less" },
          { status: 400 }
        );
      }
    }

    // Validate favorite_pro
    if (favorite_pro !== null && favorite_pro !== undefined) {
      if (typeof favorite_pro !== "string") {
        return NextResponse.json(
          { error: "Invalid favorite pro" },
          { status: 400 }
        );
      }

      if (favorite_pro.length > 100) {
        return NextResponse.json(
          { error: "Favorite pro must be 100 characters or less" },
          { status: 400 }
        );
      }
    }

    // Determine sms_opted_in_at: set on new opt-in, clear on opt-out
    const currentPlayer = sms_opt_in !== undefined
      ? await prisma.players_v2.findUnique({
          where: { uid: session.user.uid },
          select: { sms_opt_in: true, sms_opted_in_at: true },
        })
      : null;

    const smsData = sms_opt_in !== undefined
      ? {
          phone_number: phone_number?.trim() || null,
          sms_opt_in: !!sms_opt_in,
          sms_opted_in_at: sms_opt_in && !currentPlayer?.sms_opted_in_at
            ? new Date()
            : sms_opt_in
            ? currentPlayer?.sms_opted_in_at
            : null,
        }
      : {};

    const updatedPlayer = await prisma.players_v2.update({
      where: { uid: session.user.uid },
      data: {
        nickname: nickname?.trim() || null,
        favorite_hand: favorite_hand?.trim() || null,
        favorite_pro: favorite_pro?.trim() || null,
        ...smsData,
      },
      select: {
        id: true,
        uid: true,
        first_name: true,
        last_name: true,
        nickname: true,
        favorite_hand: true,
        favorite_pro: true,
        phone_number: true,
        sms_opt_in: true,
      },
    });

    // Invalidate caches if nickname was updated
    if (nickname !== undefined) {
      // Invalidate the global players cache
      await revalidatePlayersCache();

      // Find all leagues this player has appearances in and invalidate their rankings caches
      const playerLeagues = await prisma.appearances.findMany({
        where: { player_id: updatedPlayer.id },
        select: {
          games: {
            select: { league_id: true },
          },
        },
        distinct: ["game_id"],
      });

      // Get unique league IDs
      const leagueIds = [
        ...new Set(playerLeagues.map((a) => a.games.league_id)),
      ];

      // Invalidate rankings cache for each league
      for (const leagueId of leagueIds) {
        await revalidateRankingsCache(leagueId);
      }

      console.log(
        `🔄 Invalidated caches for ${leagueIds.length} league(s) after profile update`
      );
    }

    // Return with computed display name for backwards compatibility
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...playerWithoutId } = updatedPlayer;
    return NextResponse.json({
      ...playerWithoutId,
      name: getDisplayName(updatedPlayer),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
