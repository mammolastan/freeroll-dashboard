// app/api/games/[fileName]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createGameDate } from "@/lib/utils";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { fileName: string } }
) {
  try {
    // Get all players from this game
    const players: {
      Name: string;
      UID: string;
      Placement: number;
      Knockouts: number;
      Hitman: number;
      Total_Points: number;
      Start_Points: number;
      Hit_Points: number;
      Placement_Points: number;
      Venue: string;
      Season: string;
      nickname: string;
    }[] = await prisma.$queryRaw`
      SELECT 
        p.Name,
        p.UID,
        p.Placement,
        p.Knockouts,
        p.Hitman,
        p.Total_Points,
        p.Start_Points,
        p.Hit_Points,
        p.Placement_Points,
        p.Venue,
        p.Season,
        pl.nickname
      FROM poker_tournaments p
      LEFT JOIN players pl ON p.UID = pl.uid
      WHERE p.File_name = ${params.fileName}
      ORDER BY p.Placement ASC, p.Name ASC
    `;

    const serializedPlayers = players.map((player: any) => ({
      name: player.Name,
      uid: player.UID,
      nickname: player.nickname,
      placement: player.Placement,
      knockouts: player.Knockouts,
      hitman: player.Hitman,
      totalPoints: player.Total_Points,
      startPoints: player.Start_Points,
      hitPoints: player.Hit_Points,
      placementPoints: player.Placement_Points,
      venue: player.Venue,
      season: player.Season,
    }));

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

    const gameDate = createGameDate(month, day, seasonYear);

    const gameDetails = {
      players: players.map((player) => ({
        name: player.Name,
        uid: player.UID,
        nickname: player.nickname,
        placement: player.Placement,
        knockouts: player.Knockouts,
        hitman: player.Hitman,
        totalPoints: player.Total_Points,
        startPoints: player.Start_Points,
        hitPoints: player.Hit_Points,
        placementPoints: player.Placement_Points,
      })),
      venue: players[0].Venue,
      date: gameDate,
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
