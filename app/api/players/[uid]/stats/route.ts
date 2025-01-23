// app/api/players/[uid]/stats/route.ts

import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { getDateCondition } from "@/lib/utils";

const prisma = new PrismaClient();

// Interfaces for query results
interface QuarterlyStats {
  gamesPlayed: bigint;
  totalPoints: bigint;
  knockouts: bigint;
  finalTables: bigint;
  avgScore: number;
  leagueRanking?: number;
  totalPlayers?: number;
}

interface KnockedOutStats {
  name: string;
  count: bigint;
}

interface VenueStats {
  venue: string;
  points: bigint;
}
interface PlacementFrequencyResult {
  Placement: bigint;
  frequency: bigint;
}
interface RecentGame {
  date: string;
  venue: string;
  placement: number;
  points: number;
  knockouts: number;
}

export async function GET(
  request: Request,
  { params }: { params: { uid: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const playerUID = params.uid;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate =
      startDateParam && startDateParam !== "null"
        ? new Date(startDateParam)
        : null;
    const endDate =
      endDateParam && endDateParam !== "null" ? new Date(endDateParam) : null;

    // Get the date condition based on provided dates
    const dateCondition = getDateCondition(startDate, endDate);

    // If it's an all-time query, find the earliest game date
    let earliestGameDate = null;
    if (!startDate) {
      const earliestGame = await prisma.$queryRaw<{ game_date: Date }[]>`
        SELECT MIN(game_date) as game_date
        FROM poker_tournaments
        WHERE UID = ${playerUID}
      `;

      if (earliestGame.length > 0 && earliestGame[0].game_date) {
        earliestGameDate = earliestGame[0].game_date;
      }
    }

    // League ranking query - only execute if a date range is specified
    let leagueRanking = null;
    let totalPlayers = null;

    if (startDate && endDate) {
      const rankings = await prisma.$queryRaw<
        { ranking: number; total_players: number }[]
      >`
        SELECT 
          CAST(player_rank.ranking AS SIGNED) as ranking,
          CAST((
            SELECT COUNT(DISTINCT UID) 
            FROM poker_tournaments 
            WHERE ${dateCondition}
          ) AS SIGNED) as total_players
        FROM (
          SELECT 
            p1.UID,
            1 + COUNT(DISTINCT p2.UID) as ranking
          FROM 
            (SELECT UID, CAST(SUM(Total_Points) AS SIGNED) as points 
             FROM poker_tournaments 
             WHERE ${dateCondition}
             GROUP BY UID) p1
          LEFT JOIN 
            (SELECT UID, CAST(SUM(Total_Points) AS SIGNED) as points 
             FROM poker_tournaments 
             WHERE ${dateCondition}
             GROUP BY UID) p2 
          ON p1.points < p2.points
          WHERE p1.UID = ${playerUID}
          GROUP BY p1.UID
        ) as player_rank
      `;

      if (rankings && rankings.length > 0) {
        leagueRanking = Number(rankings[0].ranking);
        totalPlayers = Number(rankings[0].total_players);
      }
    }

    // Get quarterly stats
    const quarterlyStats = await prisma.$queryRaw<QuarterlyStats[]>`
      SELECT 
        COUNT(*) as gamesPlayed,
        COALESCE(SUM(Total_Points), 0) as totalPoints,
        COALESCE(SUM(Knockouts), 0) as knockouts,
        COALESCE(SUM(CASE WHEN Placement <= 8 THEN 1 ELSE 0 END), 0) as finalTables,
        COALESCE(CAST(AVG(Player_Score) AS DECIMAL(10,2)), 0) as avgScore
      FROM poker_tournaments
      WHERE UID = ${playerUID}
      ${startDate ? Prisma.sql`AND ${dateCondition}` : Prisma.sql`AND 1=1`}
    `;

    // Get players who knocked out this player most often
    const knockedOutBy = await prisma.$queryRaw`
      SELECT 
        Hitman as name,
        COUNT(*) as count
      FROM poker_tournaments
      WHERE UID = ${playerUID}
      AND Hitman IS NOT NULL
      ${startDate ? Prisma.sql`AND ${dateCondition}` : Prisma.sql`AND 1=1`}
      GROUP BY Hitman
      ORDER BY count DESC
      LIMIT 3
    `;

    // Get players this player knocked out most often
    const knockedOut = await prisma.$queryRaw`
      SELECT 
        t2.Name as name,
        COUNT(*) as count
      FROM poker_tournaments t1
      JOIN poker_tournaments t2 ON t1.File_name = t2.File_name AND t2.Hitman = t1.Name
      WHERE t1.UID = ${playerUID}
      ${
        startDate
          ? Prisma.sql`AND ${getDateCondition(startDate, endDate, "t1")}`
          : Prisma.sql`AND 1=1`
      }
      GROUP BY t2.Name
      ORDER BY count DESC
      LIMIT 3
    `;

    // Get venue statistics
    const venueStats = await prisma.$queryRaw`
      SELECT 
        Venue as venue,
        SUM(Total_Points) as points
      FROM poker_tournaments
      WHERE UID = ${playerUID}
      ${startDate ? Prisma.sql`AND ${dateCondition}` : Prisma.sql`AND 1=1`}
      GROUP BY Venue
      ORDER BY points DESC
    `;

    // Placement Frequency with proper typing
    const placementFrequency = await prisma.$queryRaw<
      PlacementFrequencyResult[]
    >`
     SELECT 
       Placement,
       COUNT(*) as frequency
     FROM poker_tournaments
     WHERE UID = ${playerUID}
     AND Placement <= 8
     ${startDate ? Prisma.sql`AND ${dateCondition}` : Prisma.sql`AND 1=1`}
     GROUP BY Placement
     ORDER BY Placement ASC
   `;

    // Get recent games
    const recentGames = await prisma.$queryRaw`
      SELECT 
        game_date as date,
        Venue as venue,
        Placement as placement,
        Total_Points as points,
        Knockouts as knockouts,
        File_name as fileName
      FROM poker_tournaments
      WHERE UID = ${playerUID}
      ${startDate ? Prisma.sql`AND ${dateCondition}` : Prisma.sql`AND 1=1`}
      ORDER BY game_date DESC
      LIMIT 50
    `;

    // Format and return the response
    const response = {
      quarterlyStats: {
        gamesPlayed: Number(quarterlyStats[0]?.gamesPlayed || 0),
        totalPoints: Number(quarterlyStats[0]?.totalPoints || 0),
        knockouts: Number(quarterlyStats[0]?.knockouts || 0),
        finalTables: Number(quarterlyStats[0]?.finalTables || 0),
        avgScore: Number(quarterlyStats[0]?.avgScore || 0),
        leagueRanking,
        totalPlayers,
      },
      mostKnockedOutBy: (knockedOutBy as any[]).map((ko) => ({
        name: ko.name,
        count: Number(ko.count),
      })),
      mostKnockedOut: (knockedOut as any[]).map((ko) => ({
        name: ko.name,
        count: Number(ko.count),
      })),
      venueStats: (venueStats as any[]).map((stat) => ({
        venue: stat.venue,
        points: Number(stat.points),
      })),
      recentGames,
      earliestGameDate: earliestGameDate?.toISOString() || null,
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
  } finally {
    await prisma.$disconnect();
  }
}
