// app/api/players/search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serializeResults(results: any[]) {
  return results.map((record) => {
    const serialized = { ...record };
    for (const key in serialized) {
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
    const unclaimedOnly = searchParams.get("unclaimed") === "true";

    if (!query) {
      return NextResponse.json([]);
    }

    if (unclaimedOnly) {
      const searchTerm = `%${query}%`;
      const players = await prisma.$queryRaw`
        SELECT
          p.uid,
          p.name,
          p.nickname,
          COUNT(DISTINCT pt.File_name) as TotalGames
        FROM players p
        LEFT JOIN poker_tournaments pt ON p.uid = pt.UID
        WHERE (p.name LIKE ${searchTerm} OR p.nickname LIKE ${searchTerm})
          AND p.email IS NULL
        GROUP BY p.uid, p.name, p.nickname
        ORDER BY COUNT(DISTINCT pt.File_name) DESC, p.name ASC
        LIMIT 10
      `;

      const serialized = serializeResults(players as any[]);
      return NextResponse.json({
        players: serialized.map((p) => ({
          uid: p.uid,
          name: p.name,
          nickname: p.nickname,
          totalGames: p.TotalGames,
        })),
      });
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
          pl.photo_url,
          COUNT(DISTINCT p.File_name) as TotalGames,
          SUM(p.Total_Points) as TotalPoints,
          MAX(p.game_date) as LastGameDate
        FROM poker_tournaments p
        LEFT JOIN players pl ON p.UID = pl.uid
        WHERE p.Name LIKE ${searchTerm}
          OR pl.nickname LIKE ${searchTerm}
        GROUP BY p.Name, p.UID, pl.nickname, pl.photo_url
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
          pl.photo_url,
          COUNT(DISTINCT p.File_name) as TotalGames,
          SUM(p.Total_Points) as TotalPoints,
          MAX(p.game_date) as LastGameDate
        FROM poker_tournaments p
        LEFT JOIN players pl ON p.UID = pl.uid
        WHERE p.UID = ${query}
        GROUP BY p.Name, p.UID, pl.nickname, pl.photo_url
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  }
}
