// app/api/games/recent/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Set revalidation cache period to 6 hours (in seconds)
export const revalidate = 3600; // 1 * 60 * 60 = 3600 seconds

export async function GET() {
  try {
    // First get all unique recent games (deduplicated by game_uid)
    const games = await prisma.$queryRaw<
      Array<{
        game_date: Date;
        Venue: string;
        game_uid: string;
      }>
    >`
      SELECT
        MAX(game_date) as game_date,
        MAX(Venue) as Venue,
        game_uid
      FROM poker_tournaments
      WHERE game_date IS NOT NULL
      GROUP BY game_uid
      ORDER BY game_date DESC
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
            knockouts: number;
            venue: string;
            uid: string;
            nickname: string;
            game_uid: string;
            photo_url: string | null;
          }>
        >`
          SELECT
            p.Name as name,
            p.Placement as placement,
            p.Total_Points as totalPoints,
            p.Knockouts as knockouts,
            p.Venue as venue,
            p.UID as uid,
            p.game_uid as game_uid,
            pl.nickname,
            pl.photo_url
          FROM poker_tournaments p
          LEFT JOIN players pl ON p.UID = pl.uid
          WHERE p.game_uid = ${game.game_uid}
          ORDER BY p.Placement ASC
        `;

        // Get top 3 players
        const topThree = players.slice(0, 3).map((player) => ({
          name: player.name,
          points: player.totalPoints || 0,
          knockouts: player.knockouts || 0,
          UID: player.uid,
          nickname: player.nickname,
          photo_url: player.photo_url,
        }));

        return {
          game_uid: game.game_uid,
          venue: game.Venue || "Unknown Venue",
          date: game.game_date.toISOString(), // Use actual game_date
          totalPlayers: players.length,
          topThree,
          totalKnockouts: players.reduce(
            (sum, player) => sum + (player.knockouts || 0),
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
