// app/api/games/player/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
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
  } finally {
    await prisma.$disconnect();
  }
}
