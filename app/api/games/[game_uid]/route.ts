// app/api/games/[game_uid]/route.ts
import { NextResponse } from "next/server";
import { formatGameDateET } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ game_uid: string }> }
) {
  try {
    const { game_uid } = await params;

    // Get game details from games table
    const game = await prisma.games.findUnique({
      where: { uid: game_uid },
      include: {
        venues: true,
      }
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Get all players from this game with their appearances and knockouts
    const players = await prisma.$queryRaw<
      Array<{
        Name: string;
        UID: string;
        Placement: number;
        Knockouts: bigint;
        Total_Points: number;
        Player_Score: number;
        Venue: string;
        Season: string;
        nickname: string | null;
        game_date: Date;
        photo_url: string | null;
      }>
    >`
      SELECT
        CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as Name,
        p.uid as UID,
        a.placement as Placement,
        (SELECT COUNT(*) FROM knockouts k WHERE k.hitman = p.id AND k.game_id = g.id) as Knockouts,
        a.points as Total_Points,
        a.player_score as Player_Score,
        v.name as Venue,
        g.season as Season,
        p.nickname,
        p.photo_url,
        g.date as game_date
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE g.uid = ${game_uid}
      ORDER BY a.placement ASC, p.first_name ASC
    `;

    if (!players.length) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Calculate game statistics
    const totalPlayers = players.length;
    const totalKnockouts = players.reduce(
      (sum, player) => sum + Number(player.Knockouts || 0),
      0
    );
    const totalPoints = players.reduce(
      (sum, player) => sum + (player.Total_Points || 0),
      0
    );
    const averagePoints = totalPoints / totalPlayers;

    const gameDate = formatGameDateET(players[0].game_date.toISOString());

    const gameDetails = {
      players: players.map((player) => ({
        name: player.Name,
        uid: player.UID,
        nickname: player.nickname,
        placement: player.Placement,
        knockouts: Number(player.Knockouts),
        totalPoints: player.Total_Points,
        playerScore: player.Player_Score,
        photo_url: player.photo_url,
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
