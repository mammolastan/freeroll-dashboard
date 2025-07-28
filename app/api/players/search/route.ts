// app/api/players/search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const isNameSearch = searchParams.get("name") === "true";

    if (!query) {
      return NextResponse.json([]);
    }

    let players;

    if (isNameSearch) {
      // Search by name or nickname - ordered by recent activity
      const searchTerm = `%${query}%`;
      players = await prisma.$queryRaw`
        SELECT 
          p.Name,
          p.UID,
          pl.nickname,
          COUNT(DISTINCT p.File_name) as TotalGames,
          SUM(p.Total_Points) as TotalPoints,
          MAX(p.game_date) as LastGameDate
        FROM poker_tournaments p
        LEFT JOIN players pl ON p.UID = pl.uid
        WHERE p.Name LIKE ${searchTerm} 
          OR pl.nickname LIKE ${searchTerm}
        GROUP BY p.Name, p.UID, pl.nickname
        ORDER BY 
          CASE 
            WHEN MAX(p.game_date) IS NULL THEN 1 
            ELSE 0 
          END,
          MAX(p.game_date) DESC,
          SUM(p.Total_Points) DESC,
          p.Name ASC
        LIMIT 10
      `;
    } else {
      // Search by exact UID match
      players = await prisma.$queryRaw`
        SELECT 
          p.Name,
          p.UID,
          pl.nickname,
          COUNT(DISTINCT p.File_name) as TotalGames,
          SUM(p.Total_Points) as TotalPoints,
          MAX(p.game_date) as LastGameDate
        FROM poker_tournaments p
        LEFT JOIN players pl ON p.UID = pl.uid
        WHERE p.UID = ${query}
        GROUP BY p.Name, p.UID, pl.nickname
        ORDER BY 
          CASE 
            WHEN MAX(p.game_date) IS NULL THEN 1 
            ELSE 0 
          END,
          MAX(p.game_date) DESC,
          SUM(p.Total_Points) DESC,
          p.Name ASC
        LIMIT 10
      `;
    }

    const serializedPlayers = serializeResults(players as any[]);

    // Remove LastGameDate from response since it's only used for sorting
    const cleanedPlayers = serializedPlayers.map((player) => {
      const { LastGameDate, ...cleanPlayer } = player;
      return cleanPlayer;
    });

    return NextResponse.json(cleanedPlayers);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search players" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
