// app/api/games/recent/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";

const prisma = new PrismaClient();

// Helper function to normalize bigint and date values
function serializeResults(results: any[]) {
  return results.map((record) => {
    const serialized = { ...record };
    for (let key in serialized) {
      if (typeof serialized[key] === "bigint") {
        serialized[key] = Number(serialized[key]);
      }
    }
    return serialized;
  });
}

export async function GET() {
  // Add cache control headers
  const headers = new Headers();
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  try {
    // First get all unique recent games
    const games = await prisma.$queryRaw<
      Array<{
        File_name: string;
        game_date: Date;
        Venue: string;
      }>
    >`
      SELECT DISTINCT
        File_name,
        game_date,
        Venue
      FROM poker_tournaments
      WHERE game_date IS NOT NULL
      ORDER BY game_date DESC
      LIMIT 15
    `;

    // Get detailed information for each game
    const gameDetails = await Promise.all(
      games.map(async (game) => {
        const players = await prisma.pokerTournament.findMany({
          where: {
            File_name: game.File_name,
          },
          select: {
            Name: true,
            Placement: true,
            Total_Points: true,
            Knockouts: true,
            Venue: true,
          },
          orderBy: {
            Placement: "asc",
          },
        });

        // Get top 3 players
        const topThree = players.slice(0, 3).map((player) => ({
          name: player.Name,
          points: player.Total_Points || 0,
          knockouts: player.Knockouts || 0,
        }));

        return {
          fileName: game.File_name,
          venue: game.Venue || "Unknown Venue",
          date: game.game_date.toISOString(), // Use actual game_date
          totalPlayers: players.length,
          topThree,
          totalKnockouts: players.reduce(
            (sum, player) => sum + (player.Knockouts || 0),
            0
          ),
        };
      })
    );

    return NextResponse.json(gameDetails);
  } catch (error) {
    console.error("Recent games error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent games" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
