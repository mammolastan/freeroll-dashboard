// app/api/players/[uid]/knockouts/route.ts
import { NextResponse } from "next/server";
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

    // Build date condition for games table
    const dateConditions: Prisma.Sql[] = [];
    if (startDate) {
      dateConditions.push(Prisma.sql`g.date >= DATE(${startDate})`);
    }
    if (endDate) {
      dateConditions.push(Prisma.sql`g.date <= DATE(${endDate})`);
    }
    const dateCondition = dateConditions.length > 0
      ? Prisma.sql`AND ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    // Venue condition
    const venueCondition =
      venue && venue !== "all"
        ? Prisma.sql`AND v.name = ${venue}`
        : Prisma.sql``;

    // Top 10 Most Knocked Out By - players who eliminated this player
    const knockedOutBy = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        CONCAT(COALESCE(hitman_p.first_name, ''), ' ', COALESCE(hitman_p.last_name, '')) as name,
        hitman_p.uid,
        hitman_p.nickname,
        COUNT(*) as count,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'date', g.date,
            'venue', v.name,
            'game_uid', g.uid
          )
        ) as games
      FROM knockouts k
      JOIN games g ON g.id = k.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 victim_p ON victim_p.id = k.victim
      JOIN players_v2 hitman_p ON hitman_p.id = k.hitman
      WHERE victim_p.uid = ${playerUID}
      AND k.hitman IS NOT NULL
      ${dateCondition}
      ${venueCondition}
      GROUP BY hitman_p.id, hitman_p.uid, hitman_p.first_name, hitman_p.last_name, hitman_p.nickname
      ORDER BY count DESC
      LIMIT 10
    `;

    // Top 10 Most Knocked Out - victims of this player
    const knockedOut = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        CONCAT(COALESCE(victim_p.first_name, ''), ' ', COALESCE(victim_p.last_name, '')) as name,
        victim_p.uid,
        victim_p.nickname,
        COUNT(*) as count,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'date', g.date,
            'venue', v.name,
            'game_uid', g.uid
          )
        ) as games
      FROM knockouts k
      JOIN games g ON g.id = k.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 hitman_p ON hitman_p.id = k.hitman
      JOIN players_v2 victim_p ON victim_p.id = k.victim
      WHERE hitman_p.uid = ${playerUID}
      ${dateCondition}
      ${venueCondition}
      GROUP BY victim_p.id, victim_p.uid, victim_p.first_name, victim_p.last_name, victim_p.nickname
      ORDER BY count DESC
      LIMIT 10
    `;

    // Head-to-head comparison data (if compareUid is provided)
    let headToHead = null;
    if (compareUid) {
      // Get player names from players_v2
      const playerData = await prisma.players_v2.findUnique({
        where: { uid: playerUID },
        select: { first_name: true, last_name: true, nickname: true }
      });

      const comparePlayerData = await prisma.players_v2.findUnique({
        where: { uid: compareUid },
        select: { first_name: true, last_name: true, nickname: true }
      });

      // Knockouts by main player against compare player
      const knockoutsByPlayer = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          g.date,
          v.name as venue,
          g.uid as game_uid
        FROM knockouts k
        JOIN games g ON g.id = k.game_id
        JOIN venues v ON v.id = g.venue_id
        JOIN players_v2 hitman_p ON hitman_p.id = k.hitman
        JOIN players_v2 victim_p ON victim_p.id = k.victim
        WHERE hitman_p.uid = ${playerUID}
        AND victim_p.uid = ${compareUid}
        ${dateCondition}
        ${venueCondition}
        ORDER BY g.date DESC
      `;

      // Knockouts by compare player against main player
      const knockoutsByCompare = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          g.date,
          v.name as venue,
          g.uid as game_uid
        FROM knockouts k
        JOIN games g ON g.id = k.game_id
        JOIN venues v ON v.id = g.venue_id
        JOIN players_v2 hitman_p ON hitman_p.id = k.hitman
        JOIN players_v2 victim_p ON victim_p.id = k.victim
        WHERE hitman_p.uid = ${compareUid}
        AND victim_p.uid = ${playerUID}
        ${dateCondition}
        ${venueCondition}
        ORDER BY g.date DESC
      `;

      // Games where both players participated
      const gamesPlayed = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          g.date,
          v.name as venue,
          g.uid as game_uid,
          a1.placement as player1Placement,
          a2.placement as player2Placement
        FROM appearances a1
        JOIN games g ON g.id = a1.game_id
        JOIN venues v ON v.id = g.venue_id
        JOIN players_v2 p1 ON p1.id = a1.player_id
        JOIN appearances a2 ON a2.game_id = g.id
        JOIN players_v2 p2 ON p2.id = a2.player_id
        WHERE p1.uid = ${playerUID}
        AND p2.uid = ${compareUid}
        ${dateCondition}
        ${venueCondition}
        ORDER BY g.date DESC
      `;

      headToHead = {
        player: {
          uid: playerUID,
          name: `${playerData?.first_name || ''} ${playerData?.last_name || ''}`.trim() || "Unknown",
          nickname: playerData?.nickname || null,
          knockouts: knockoutsByPlayer,
        },
        comparePlayer: {
          uid: compareUid,
          name: `${comparePlayerData?.first_name || ''} ${comparePlayerData?.last_name || ''}`.trim() || "Unknown",
          nickname: comparePlayerData?.nickname || null,
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
        (SELECT COUNT(*) FROM knockouts k
         JOIN games g ON g.id = k.game_id
         JOIN venues v ON v.id = g.venue_id
         JOIN players_v2 p ON p.id = k.victim
         WHERE p.uid = ${playerUID}
         ${dateCondition}
         ${venueCondition}) as knockedOutCount,
        (SELECT COUNT(*) FROM knockouts k
         JOIN games g ON g.id = k.game_id
         JOIN venues v ON v.id = g.venue_id
         JOIN players_v2 p ON p.id = k.hitman
         WHERE p.uid = ${playerUID}
         ${dateCondition}
         ${venueCondition}) as knockoutCount
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
