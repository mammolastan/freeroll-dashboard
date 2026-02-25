// app/api/players/[uid]/stats/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

    // Venue condition - joins with venues table
    const venueCondition =
      venue && venue !== "all"
        ? Prisma.sql`AND v.name = ${venue}`
        : Prisma.sql``;

    // Get available venues for this player within the date range
    const availableVenues: { venue: string }[] = await prisma.$queryRaw`
      SELECT DISTINCT v.name as venue
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE p.uid = ${playerUID}
      AND v.name != 'bonus'
      ${dateCondition}
      ORDER BY v.name
    `;

    // Earliest game date query
    const earliestGameQuery = await prisma.$queryRaw<{ earliest_date: Date }[]>`
      SELECT MIN(g.date) as earliest_date
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE p.uid = ${playerUID}
    `;

    const earliestGameDate =
      earliestGameQuery[0]?.earliest_date?.toISOString() || null;

    // Quarterly stats - aggregates from appearances
    const quarterlyStats: {
      gamesPlayed: number;
      totalPoints: number;
      knockouts: number;
      finalTables: number;
      avgScore: number;
      finalTablePercentage: number;
    }[] = await prisma.$queryRaw`
      SELECT
        COUNT(CASE WHEN v.name != 'bonus' THEN 1 END) as gamesPlayed,
        COALESCE(SUM(a.points), 0) as totalPoints,
        COALESCE((
          SELECT COUNT(*) FROM knockouts k
          JOIN games kg ON kg.id = k.game_id
          JOIN players_v2 kp ON kp.id = k.hitman
          WHERE kp.uid = ${playerUID}
          ${startDate ? Prisma.sql`AND kg.date >= DATE(${startDate})` : Prisma.sql``}
          ${endDate ? Prisma.sql`AND kg.date <= DATE(${endDate})` : Prisma.sql``}
        ), 0) as knockouts,
        COALESCE(SUM(CASE WHEN a.placement <= 8 THEN 1 ELSE 0 END), 0) as finalTables,
        COALESCE(CAST(AVG(a.player_score) AS DECIMAL(10,2)), 0) as avgScore,
        COALESCE(CAST(
          (SUM(CASE WHEN a.placement <= 8 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))
          AS DECIMAL(10,2)
        ), 0) as finalTablePercentage
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE p.uid = ${playerUID}
      ${dateCondition}
      ${venueCondition}
    `;

    // Most Knocked Out By - using knockouts table
    const knockedOutBy: {
      name: string;
      uid: string;
      nickname: string | null;
      count: number;
    }[] = await prisma.$queryRaw`
      SELECT
        CONCAT(COALESCE(hitman_p.first_name, ''), ' ', COALESCE(hitman_p.last_name, '')) as name,
        hitman_p.uid,
        hitman_p.nickname,
        COUNT(*) as count
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
      LIMIT 3
    `;

    // Most Knocked Out - using knockouts table
    const knockedOut: {
      name: string;
      uid: string;
      nickname: string | null;
      count: number;
    }[] = await prisma.$queryRaw`
      SELECT
        CONCAT(COALESCE(victim_p.first_name, ''), ' ', COALESCE(victim_p.last_name, '')) as name,
        victim_p.uid,
        victim_p.nickname,
        COUNT(*) as count
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
      LIMIT 3
    `;

    // Venue Stats
    const venueStatsRaw = await prisma.$queryRaw<
      Array<{ venue: string; points: bigint }>
    >`
        SELECT
          v.name as venue,
          SUM(a.points) as points
        FROM appearances a
        JOIN games g ON g.id = a.game_id
        JOIN venues v ON v.id = g.venue_id
        JOIN players_v2 p ON p.id = a.player_id
        WHERE p.uid = ${playerUID}
        ${dateCondition}
        ${venueCondition}
        GROUP BY v.id, v.name
        ORDER BY points DESC
      `;

    const venueStats = venueStatsRaw.map((stat) => ({
      venue: stat.venue,
      points: Number(stat.points),
    }));

    // Recent Games
    const recentGamesRaw = await prisma.$queryRaw<
      Array<{
        date: Date;
        venue: string;
        placement: number;
        points: number;
        knockouts: bigint;
        game_uid: string;
      }>
    >`
      SELECT
        g.date,
        v.name as venue,
        a.placement,
        a.points,
        (SELECT COUNT(*) FROM knockouts k WHERE k.hitman = a.player_id AND k.game_id = g.id) as knockouts,
        g.uid as game_uid
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE p.uid = ${playerUID}
      ${dateCondition}
      ${venueCondition}
      ORDER BY g.date DESC
      LIMIT 50
    `;

    // Serialize BigInt values in recentGames
    const recentGames = recentGamesRaw.map((game) => ({
      date: game.date,
      venue: game.venue,
      placement: game.placement,
      points: game.points,
      knockouts: Number(game.knockouts),
      game_uid: game.game_uid,
    }));

    // Placement Frequency
    const placementFrequency = await prisma.$queryRaw<
      { Placement: number; frequency: bigint }[]
    >`
      SELECT
        a.placement as Placement,
        COUNT(*) as frequency
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE p.uid = ${playerUID}
      ${dateCondition}
      ${venueCondition}
      AND a.placement <= 8
      GROUP BY a.placement
      ORDER BY a.placement ASC
    `;

    const response = {
      quarterlyStats: {
        gamesPlayed: Number(quarterlyStats[0]?.gamesPlayed || 0),
        totalPoints: Number(quarterlyStats[0]?.totalPoints || 0),
        knockouts: Number(quarterlyStats[0]?.knockouts || 0),
        finalTables: Number(quarterlyStats[0]?.finalTables || 0),
        avgScore: Number(quarterlyStats[0]?.avgScore || 0),
        finalTablePercentage: Number(
          quarterlyStats[0]?.finalTablePercentage || 0
        ),
      },
      availableVenues: availableVenues.map((v) => v.venue),
      mostKnockedOutBy: knockedOutBy.map((ko) => ({
        name: ko.name,
        uid: ko.uid,
        nickname: ko.nickname,
        count: Number(ko.count),
      })),
      mostKnockedOut: knockedOut.map((ko) => ({
        name: ko.name,
        uid: ko.uid,
        nickname: ko.nickname,
        count: Number(ko.count),
      })),
      venueStats,
      recentGames,
      earliestGameDate,
      placementFrequency: placementFrequency.map((pf) => ({
        placement: Number(pf.Placement),
        frequency: Number(pf.frequency),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Player stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch player stats" },
      { status: 500 }
    );
  }
}
