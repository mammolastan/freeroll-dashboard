// app/api/games/player/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    const data = await request.json();

    const player = await prisma.pokerTournament.update({
      where: { id },
      data: {
        placement: data.placement,
        startPoints: data.startPoints,
        hitman: data.hitman || null,
        totalPoints: data.totalPoints,
        playerScore: data.playerScore,
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
    });

    return NextResponse.json(player);
  } catch (error) {
    console.error("Error updating player:", error);
    return NextResponse.json(
      { error: "Failed to update player" },
      { status: 500 }
    );
  }
}
