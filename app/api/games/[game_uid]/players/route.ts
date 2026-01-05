// app/api/games/[game_uid]/players/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game_uid: string }> }
) {
  try {
    // The identifier could be either game_uid or fileName (as fallback)
    const { game_uid } = await params;
    const identifier = decodeURIComponent(game_uid);

    // Try to find players by game_uid first, then fallback to fileName
    const players = await prisma.pokerTournament.findMany({
      where: {
        OR: [
          { gameUid: identifier }, // Try game_uid first
          { fileName: identifier }, // Fallback to fileName
        ],
      },
      select: {
        id: true,
        name: true,
        uid: true,
        placement: true,
        startPoints: true,
        hitman: true,
        totalPoints: true,
        playerScore: true,
      },
      orderBy: {
        placement: "asc",
      },
    });

    return NextResponse.json({ players });
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}
