// app/api/players/[uid]/knockouts/route.ts
import { NextResponse } from "next/server";
import { getDateCondition } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const { uid } = await params;
    const playerUID = uid;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const venue = searchParams.get("venue");
    const compareUid = searchParams.get("compareUid"); // For head-to-head comparison

    const startDate =
      startDateParam && startDateParam !== "null"
        ? new Date(startDateParam)
        : null;
    const endDate =
      endDateParam && endDateParam !== "null" ? new Date(endDateParam) : null;

    // Base venue condition
    const venueCondition =
      venue && venue !== "all"
        ? Prisma.sql`AND p1.Venue = ${venue}`
        : Prisma.sql``;

    const dateConditionP1 = getDateCondition(startDate, endDate, "p1");

    // Top 10 Most Knocked Out By
    // Uses Hitman_UID when available, falls back to name-based join for historical data
    const knockedOutBy = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        COALESCE(p2.Name, p2_fallback.Name) as name,
        COALESCE(p1.Hitman_UID, p2_fallback.UID) as uid,
        COALESCE(pl.nickname, pl_fallback.nickname) as nickname,
        COUNT(*) as count,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'date', p1.game_date,
            'venue', p1.Venue,
            'fileName', p1.File_name
          )
        ) as games
      FROM poker_tournaments p1
      LEFT JOIN poker_tournaments p2
        ON p1.Hitman_UID IS NOT NULL
        AND p2.UID = p1.Hitman_UID
        AND p2.File_name = p1.File_name
      LEFT JOIN poker_tournaments p2_fallback
        ON p1.Hitman_UID IS NULL
        AND p2_fallback.Name = p1.Hitman
        AND p2_fallback.File_name = p1.File_name
      LEFT JOIN players pl ON p2.UID = pl.uid
      LEFT JOIN players pl_fallback ON p2_fallback.UID = pl_fallback.uid
      WHERE p1.UID = ${playerUID}
      AND p1.Hitman IS NOT NULL
      ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
      ${venueCondition}
      GROUP BY COALESCE(p2.Name, p2_fallback.Name), COALESCE(p1.Hitman_UID, p2_fallback.UID), COALESCE(pl.nickname, pl_fallback.nickname)
      ORDER BY count DESC
      LIMIT 10
    `;

    // Top 10 Most Knocked Out
    // Uses Hitman_UID when available, falls back to name-based join for historical data
    const knockedOut = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        COALESCE(p2.Name, p2_fallback.Name) as name,
        COALESCE(p2.UID, p2_fallback.UID) as uid,
        COALESCE(pl.nickname, pl_fallback.nickname) as nickname,
        COUNT(*) as count,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'date', p1.game_date,
            'venue', p1.Venue,
            'fileName', p1.File_name
          )
        ) as games
      FROM poker_tournaments p1
      LEFT JOIN poker_tournaments p2
        ON p2.Hitman_UID IS NOT NULL
        AND p2.Hitman_UID = p1.UID
        AND p2.File_name = p1.File_name
      LEFT JOIN poker_tournaments p2_fallback
        ON p2_fallback.Hitman_UID IS NULL
        AND p2_fallback.Hitman = p1.Name
        AND p2_fallback.File_name = p1.File_name
      LEFT JOIN players pl ON p2.UID = pl.uid
      LEFT JOIN players pl_fallback ON p2_fallback.UID = pl_fallback.uid
      WHERE p1.UID = ${playerUID}
      AND (p2.id IS NOT NULL OR p2_fallback.id IS NOT NULL)
      ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
      ${venueCondition}
      GROUP BY COALESCE(p2.Name, p2_fallback.Name), COALESCE(p2.UID, p2_fallback.UID), COALESCE(pl.nickname, pl_fallback.nickname)
      ORDER BY count DESC
      LIMIT 10
    `;

    // Head-to-head comparison data (if compareUid is provided)
    let headToHead = null;
    if (compareUid) {
      // Get player names
      const playerData = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT p.Name as name, pl.nickname 
        FROM poker_tournaments p
        LEFT JOIN players pl ON p.UID = pl.uid
        WHERE p.UID = ${playerUID}
        LIMIT 1
      `;

      const comparePlayerData = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT p.Name as name, pl.nickname 
        FROM poker_tournaments p
        LEFT JOIN players pl ON p.UID = pl.uid
        WHERE p.UID = ${compareUid}
        LIMIT 1
      `;

      // Knockouts by main player against compare player
      // Uses Hitman_UID when available, falls back to name-based join
      const knockoutsByPlayer = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          p1.game_date as date,
          p1.Venue as venue,
          p1.File_name as fileName
        FROM poker_tournaments p1
        JOIN poker_tournaments p2 ON p2.File_name = p1.File_name
          AND ((p2.Hitman_UID IS NOT NULL AND p2.Hitman_UID = p1.UID)
               OR (p2.Hitman_UID IS NULL AND p2.Hitman = p1.Name))
        WHERE p1.UID = ${playerUID} AND p2.UID = ${compareUid}
        ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
        ${venueCondition}
        ORDER BY p1.game_date DESC
      `;

      // Knockouts by compare player against main player
      // Uses Hitman_UID when available, falls back to name-based join
      const knockoutsByCompare = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          p1.game_date as date,
          p1.Venue as venue,
          p1.File_name as fileName
        FROM poker_tournaments p1
        JOIN poker_tournaments p2 ON p2.File_name = p1.File_name
          AND ((p1.Hitman_UID IS NOT NULL AND p1.Hitman_UID = p2.UID)
               OR (p1.Hitman_UID IS NULL AND p1.Hitman = p2.Name))
        WHERE p1.UID = ${playerUID} AND p2.UID = ${compareUid}
        ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
        ${venueCondition}
        ORDER BY p1.game_date DESC
      `;

      // Games where both players participated but neither knocked out the other
      const gamesPlayed = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT 
          p1.game_date as date,
          p1.Venue as venue,
          p1.File_name as fileName,
          p1.Placement as player1Placement,
          p2.Placement as player2Placement
        FROM poker_tournaments p1
        JOIN poker_tournaments p2 ON p2.File_name = p1.File_name
        WHERE p1.UID = ${playerUID} AND p2.UID = ${compareUid}
        ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
        ${venueCondition}
        ORDER BY p1.game_date DESC
      `;

      headToHead = {
        player: {
          uid: playerUID,
          name: String(playerData[0]?.name) || "Unknown",
          nickname: playerData[0]?.nickname || null,
          knockouts: knockoutsByPlayer,
        },
        comparePlayer: {
          uid: compareUid,
          name: String(comparePlayerData[0]?.name) || "Unknown",
          nickname: comparePlayerData[0]?.nickname || null,
          knockouts: knockoutsByCompare,
        },
        gamesPlayed,
      };
    }

    // Process the results and sort games by date descending (newest first)
    const sortGamesByDateDesc = (games: { date: string }[]) =>
      [...games].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const knockedOutByParsed = knockedOutBy.map((ko) => {
      const games = typeof ko.games === "string" ? JSON.parse(ko.games) : ko.games;
      return {
        name: ko.name,
        uid: ko.uid,
        nickname: ko.nickname,
        count: Number(ko.count),
        games: sortGamesByDateDesc(games),
      };
    });

    const knockedOutParsed = knockedOut.map((ko) => {
      const games = typeof ko.games === "string" ? JSON.parse(ko.games) : ko.games;
      return {
        name: ko.name,
        uid: ko.uid,
        nickname: ko.nickname,
        count: Number(ko.count),
        games: sortGamesByDateDesc(games),
      };
    });

    // Total knockout stats
    const totalStats = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT 
        SUM(CASE WHEN p1.Hitman IS NOT NULL THEN 1 ELSE 0 END) as knockedOutCount,
        SUM(p1.Knockouts) as knockoutCount
      FROM poker_tournaments p1
      WHERE p1.UID = ${playerUID}
      ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
      ${venueCondition}
    `;

    const response = {
      knockedOutBy: knockedOutByParsed,
      knockedOut: knockedOutParsed,
      totalStats: {
        knockedOutCount: Number(totalStats[0]?.knockedOutCount || 0),
        knockoutCount: Number(totalStats[0]?.knockoutCount || 0),
      },
      headToHead,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Knockout stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch knockout stats" },
      { status: 500 }
    );
  }
}
