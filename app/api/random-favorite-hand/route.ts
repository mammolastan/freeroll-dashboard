// app/api/random-favorite-hand/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get all players who have a favorite hand set
    const playersWithFavoriteHands = await prisma.player.findMany({
      where: {
        favorite_hand: {
          not: null,
        },
      },
      select: {
        name: true,
        nickname: true,
        favorite_hand: true,
      },
    });

    // Filter out any with empty strings
    const validPlayers = playersWithFavoriteHands.filter(
      (p) => p.favorite_hand && p.favorite_hand.trim() !== ""
    );

    if (validPlayers.length === 0) {
      return NextResponse.json(
        { error: "No favorite hands found" },
        { status: 404 }
      );
    }

    // Pick a random player
    const randomIndex = Math.floor(Math.random() * validPlayers.length);
    const selected = validPlayers[randomIndex];

    return NextResponse.json({
      hand: selected.favorite_hand,
      playerName: selected.nickname || selected.name,
      totalHands: validPlayers.length,
    });
  } catch (error) {
    console.error("Error fetching random favorite hand:", error);
    return NextResponse.json(
      { error: "Failed to fetch random favorite hand" },
      { status: 500 }
    );
  }
}
