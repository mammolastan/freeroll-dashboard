// app/api/games/recent/[date]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const { date } = params;

    // Convert input date string to a Date object
    const selectedDate = new Date(date);

    const games = await prisma.pokerTournament.findMany({
      where: {
        gameDate: selectedDate,
      },
      orderBy: {
        gameDate: "desc",
      },
      select: {
        id: true,
        gameDate: true,
        fileName: true,
        season: true,
        venue: true,
      },
      distinct: ["fileName"], // Ensure we don't get duplicate games
    });

    return NextResponse.json({ games });
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
