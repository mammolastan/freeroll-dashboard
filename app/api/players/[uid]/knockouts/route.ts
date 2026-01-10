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
    const knockedOutBy = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT 
        p2.Name as name,
        p2.UID as uid,
        pl.nickname,
        COUNT(*) as count,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'date', p1.game_date,
            'venue', p1.Venue,
            'fileName', p1.File_name
          )
        ) as games
      FROM poker_tournaments p1
      JOIN poker_tournaments p2 ON p2.Name = p1.Hitman AND p2.File_name = p1.File_name
      LEFT JOIN players pl ON p2.UID = pl.uid
      WHERE p1.UID = ${playerUID}
      AND p1.Hitman IS NOT NULL
      ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
      ${venueCondition}
      GROUP BY p2.Name, p2.UID, pl.nickname
      ORDER BY count DESC
      LIMIT 10
    `;

    // Top 10 Most Knocked Out
    const knockedOut = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT 
        p2.Name as name,
        p2.UID as uid,
        pl.nickname,
        COUNT(*) as count,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'date', p1.game_date,
            'venue', p1.Venue,
            'fileName', p1.File_name
          )
        ) as games
      FROM poker_tournaments p1
      JOIN poker_tournaments p2 ON p2.File_name = p1.File_name AND p2.Hitman = p1.Name
      LEFT JOIN players pl ON p2.UID = pl.uid
      WHERE p1.UID = ${playerUID}
      ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
      ${venueCondition}
      GROUP BY p2.Name, p2.UID, pl.nickname
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
      const knockoutsByPlayer = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT 
          p1.game_date as date,
          p1.Venue as venue,
          p1.File_name as fileName
        FROM poker_tournaments p1
        JOIN poker_tournaments p2 ON p2.File_name = p1.File_name AND p2.Hitman = p1.Name
        WHERE p1.UID = ${playerUID} AND p2.UID = ${compareUid}
        ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
        ${venueCondition}
        ORDER BY p1.game_date DESC
      `;

      // Knockouts by compare player against main player
      const knockoutsByCompare = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT 
          p1.game_date as date,
          p1.Venue as venue,
          p1.File_name as fileName
        FROM poker_tournaments p1
        JOIN poker_tournaments p2 ON p2.Name = p1.Hitman AND p2.File_name = p1.File_name
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

    // Process the results
    const knockedOutByParsed = knockedOutBy.map((ko) => ({
      name: ko.name,
      uid: ko.uid,
      nickname: ko.nickname,
      count: Number(ko.count),
      games: typeof ko.games === "string" ? JSON.parse(ko.games) : ko.games,
    }));

    const knockedOutParsed = knockedOut.map((ko) => ({
      name: ko.name,
      uid: ko.uid,
      nickname: ko.nickname,
      count: Number(ko.count),
      games: typeof ko.games === "string" ? JSON.parse(ko.games) : ko.games,
    }));

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
