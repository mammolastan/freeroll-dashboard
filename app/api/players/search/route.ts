// app/api/players/search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

function serializeResults(results: RawQueryResult[]) {
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
      const players = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          p.uid,
          CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
          p.nickname,
          COUNT(DISTINCT a.game_id) as TotalGames
        FROM players_v2 p
        LEFT JOIN appearances a ON p.id = a.player_id
        WHERE (CONCAT(p.first_name, ' ', p.last_name) LIKE ${searchTerm} OR p.nickname LIKE ${searchTerm})
          AND p.email IS NULL
        GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname
        ORDER BY COUNT(DISTINCT a.game_id) DESC, p.first_name ASC
        LIMIT 10
      `;

      const serialized = serializeResults(players);
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
      players = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as Name,
          p.uid as UID,
          p.nickname,
          p.photo_url,
          p.favorite_hand,
          p.favorite_pro,
          COUNT(DISTINCT a.game_id) as TotalGames,
          COALESCE(SUM(a.points), 0) as TotalPoints,
          MAX(g.date) as LastGameDate
        FROM players_v2 p
        LEFT JOIN appearances a ON p.id = a.player_id
        LEFT JOIN games g ON g.id = a.game_id
        WHERE CONCAT(p.first_name, ' ', p.last_name) LIKE ${searchTerm}
          OR p.first_name LIKE ${searchTerm}
          OR p.last_name LIKE ${searchTerm}
          OR p.nickname LIKE ${searchTerm}
        GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname, p.photo_url, p.favorite_hand, p.favorite_pro
        ORDER BY
          CASE
            WHEN MAX(g.date) IS NULL THEN 1
            ELSE 0
          END,
          MAX(g.date) DESC,
          SUM(a.points) DESC,
          p.first_name ASC
        LIMIT 10
      `;
    } else {
      // Search by exact UID match
      players = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as Name,
          p.uid as UID,
          p.nickname,
          p.photo_url,
          p.favorite_hand,
          p.favorite_pro,
          COUNT(DISTINCT a.game_id) as TotalGames,
          COALESCE(SUM(a.points), 0) as TotalPoints,
          MAX(g.date) as LastGameDate
        FROM players_v2 p
        LEFT JOIN appearances a ON p.id = a.player_id
        LEFT JOIN games g ON g.id = a.game_id
        WHERE p.uid = ${query}
        GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname, p.photo_url, p.favorite_hand, p.favorite_pro
        ORDER BY
          CASE
            WHEN MAX(g.date) IS NULL THEN 1
            ELSE 0
          END,
          MAX(g.date) DESC,
          SUM(a.points) DESC,
          p.first_name ASC
        LIMIT 10
      `;
    }

    const serializedPlayers = serializeResults(players);

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
