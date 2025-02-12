// app/api/games/[fileName]/players/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { fileName: string } }
) {
  try {
    const players = await prisma.pokerTournament.findMany({
      where: {
        fileName: params.fileName,
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
  } finally {
    await prisma.$disconnect();
  }
}
