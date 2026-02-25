// app/api/games/recent/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Set revalidation cache period to 6 hours (in seconds)
export const revalidate = 3600; // 1 * 60 * 60 = 3600 seconds

export async function GET() {
  try {
    // Get recent games from the games table
    const games = await prisma.$queryRaw<
      Array<{
        game_uid: string;
        game_date: Date;
        venue: string;
        totalPlayers: bigint;
      }>
    >`
      SELECT
        g.uid as game_uid,
        g.date as game_date,
        v.name as venue,
        COUNT(a.player_id) as totalPlayers
      FROM games g
      JOIN venues v ON v.id = g.venue_id
      LEFT JOIN appearances a ON a.game_id = g.id
      WHERE g.date IS NOT NULL
      GROUP BY g.id, g.uid, g.date, v.name
      ORDER BY g.date DESC
      LIMIT 15
    `;

    // Get detailed information for each game
    const gameDetails = await Promise.all(
      games.map(async (game) => {
        const players = await prisma.$queryRaw<
          Array<{
            name: string;
            placement: number;
            totalPoints: number;
            knockouts: bigint;
            venue: string;
            uid: string;
            nickname: string | null;
            game_uid: string;
            photo_url: string | null;
          }>
        >`
          SELECT
            CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
            a.placement,
            a.points as totalPoints,
            (SELECT COUNT(*) FROM knockouts k WHERE k.hitman = p.id AND k.game_id = g.id) as knockouts,
            v.name as venue,
            p.uid,
            g.uid as game_uid,
            p.nickname,
            p.photo_url
          FROM appearances a
          JOIN games g ON g.id = a.game_id
          JOIN venues v ON v.id = g.venue_id
          JOIN players_v2 p ON p.id = a.player_id
          WHERE g.uid = ${game.game_uid}
          ORDER BY a.placement ASC
        `;

        // Get top 3 players
        const topThree = players.slice(0, 3).map((player) => ({
          name: player.name,
          points: player.totalPoints || 0,
          knockouts: Number(player.knockouts) || 0,
          UID: player.uid,
          nickname: player.nickname,
          photo_url: player.photo_url,
        }));

        return {
          game_uid: game.game_uid,
          venue: game.venue || "Unknown Venue",
          date: game.game_date.toISOString(),
          totalPlayers: Number(game.totalPlayers),
          topThree,
          totalKnockouts: players.reduce(
            (sum, player) => sum + (Number(player.knockouts) || 0),
            0
          ),
        };
      })
    );

    const response = {
      games: gameDetails,
      fetchTimestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Recent games error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent games" },
      { status: 500 }
    );
  }
}
