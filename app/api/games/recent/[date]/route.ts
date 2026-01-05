// app/api/games/recent/[date]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;

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
        gameUid: true, // Use gameUid instead of uid (which is player UID)
      },
      distinct: ["fileName"], // Ensure we don't get duplicate games
    });

    // For each game, get the player count and processed date
    const gamesWithDetails = await Promise.all(
      games.map(async (game) => {
        // Get player count
        const playerCount = await prisma.pokerTournament.count({
          where: {
            fileName: game.fileName,
          },
        });

        // Get processed file info
        let processedAt = null;
        const processedFile = await prisma.processedFile.findFirst({
          where: {
            OR: [
              { game_uid: game.gameUid || undefined },
              ...(game.fileName ? [{ filename: game.fileName }] : []),
            ],
          },
          select: {
            processed_at: true,
          },
        });

        if (processedFile) {
          processedAt = processedFile.processed_at;
        }

        return {
          ...game,
          game_uid: game.gameUid || game.fileName, // Use gameUid if available, fallback to fileName
          playerCount,
          processedAt,
        };
      })
    );

    return NextResponse.json({ games: gamesWithDetails });
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}
