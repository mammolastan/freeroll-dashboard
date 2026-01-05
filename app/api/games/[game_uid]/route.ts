// app/api/games/[fileName]/route.ts
import { NextResponse } from "next/server";
import { formatGameDateET } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ game_uid: string }> }
) {
  try {
    const { game_uid } = await params;

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
      file_name: string;
      game_date: string;
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
        p.game_uid,
        p.file_name,
        pl.nickname,
        p.game_date
      FROM poker_tournaments p
      LEFT JOIN players pl ON p.UID = pl.uid
      WHERE p.game_uid = ${game_uid}
      ORDER BY p.Placement ASC, p.Name ASC
    `;

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

    // const gameDate = createGameDate(month, day, seasonYear);
    const gameDate = formatGameDateET(players[0].game_date);

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
  }
}
