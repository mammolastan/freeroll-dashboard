import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Fetch current user's profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const player = await prisma.player.findUnique({
      where: { uid: session.user.uid },
      select: {
        uid: true,
        name: true,
        nickname: true,
        email: true,
        photo_url: true,
        favorite_hand: true,
        favorite_pro: true,
        created_at: true,
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json(player);
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

    const { nickname, favorite_hand, favorite_pro } = await request.json();

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

    const updatedPlayer = await prisma.player.update({
      where: { uid: session.user.uid },
      data: {
        nickname: nickname?.trim() || null,
        favorite_hand: favorite_hand?.trim() || null,
        favorite_pro: favorite_pro?.trim() || null,
      },
      select: {
        uid: true,
        name: true,
        nickname: true,
        favorite_hand: true,
        favorite_pro: true,
      },
    });

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
