// app/api/games/recent/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { createGameDate } from "@/lib/utils";

const prisma = new PrismaClient();

// Helper function to parse game date from fileName and season
function parseGameDate(fileName: string, season: string): string {
  try {
    const dateParts = fileName.split("_")[0];
    const month = parseInt(dateParts.substring(0, 2)) - 1; // Months are 0-based
    const day = parseInt(dateParts.substring(2, 4));
    const year = parseInt(
      season.split(" ").pop() || new Date().getFullYear().toString()
    );

    return createGameDate(month, day, year);
  } catch (error) {
    console.error("Error parsing date:", { fileName, season, error });
    return new Date(0).toISOString(); // Return epoch date for invalid dates
  }
}

export async function GET() {
  try {
    // First get all unique games with non-null required fields
    const games = await prisma.$queryRaw<
      Array<{
        File_name: string;
        Season: string;
        game_date: Date;
      }>
    >`
            SELECT DISTINCT
                File_name,
                Season,
                STR_TO_DATE(
                    CONCAT(
                        SUBSTRING(File_name, 1, 2), -- Month
                        SUBSTRING(File_name, 3, 2), -- Day
                        SUBSTRING_INDEX(Season, ' ', -1) -- Year
                    ),
                    '%m%d%Y'
                ) as game_date
            FROM poker_tournaments
            WHERE File_name IS NOT NULL
                AND Season IS NOT NULL
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

        const gameDate = parseGameDate(game.File_name, game.Season);

        // Get top 3 players
        const topThree = players.slice(0, 3).map((player) => ({
          name: player.Name,
          points: player.Total_Points || 0,
          knockouts: player.Knockouts || 0,
        }));

        return {
          fileName: game.File_name,
          venue: players[0]?.Venue || "Unknown Venue",
          date: gameDate, // Now using the string directly
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
