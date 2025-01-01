// app/api/games/[fileName]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { fileName: string } }
) {
  try {
    // Get all players from this game
    const players = await prisma.pokerTournament.findMany({
      where: {
        File_name: params.fileName,
      },
      select: {
        Name: true,
        UID: true,
        Placement: true,
        Knockouts: true,
        Hitman: true,
        Total_Points: true,
        Start_Points: true,
        Hit_Points: true,
        Placement_Points: true,
        Venue: true,
        Season: true,
      },
      orderBy: [
        {
          Placement: "asc",
        },
        {
          Name: "asc", // Secondary sort to ensure consistent ordering
        },
      ],
    });

    if (!players.length) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Calculate game statistics
    const totalPlayers = players.length;
    const totalKnockouts = players.reduce(
      (sum, player) => sum + (player.Knockouts || 0),
      0
    );
    const totalPoints = players.reduce(
      (sum, player) => sum + (player.Total_Points || 0),
      0
    );
    const averagePoints = totalPoints / totalPlayers;

    // Parse the date from the game ID (format: MMDD_venue_type.tdt)
    const dateParts = params.fileName.split("_")[0];
    const month = parseInt(dateParts.substring(0, 2)) - 1; // Months are 0-based
    const day = parseInt(dateParts.substring(2, 4));

    // Get year from season
    const seasonYear = players[0].Season
      ? parseInt(
          players[0].Season.split(" ").pop() ||
            new Date().getFullYear().toString()
        )
      : new Date().getFullYear();
    const gameDate = new Date(seasonYear, month, day);

    const gameDetails = {
      players: players.map((player) => ({
        name: player.Name,
        uid: player.UID,
        placement: player.Placement,
        knockouts: player.Knockouts,
        hitman: player.Hitman,
        totalPoints: player.Total_Points,
        startPoints: player.Start_Points,
        hitPoints: player.Hit_Points,
        placementPoints: player.Placement_Points,
      })),
      venue: players[0].Venue,
      date: gameDate.toISOString(),
      totalPlayers,
      totalKnockouts,
      averagePoints,
    };

    return NextResponse.json(gameDetails);
  } catch (error) {
    console.error("Game details error:", error);
    return NextResponse.json(
      { error: "Failed to fetch game details" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
