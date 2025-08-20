// app/api/players/[uid]/stats/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { getDateCondition } from "@/lib/utils";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { uid: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const playerUID = params.uid;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const venue = searchParams.get("venue");

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

    const dateCondition = getDateCondition(startDate, endDate);
    const dateConditionP = getDateCondition(startDate, endDate, "p");
    const dateConditionP1 = getDateCondition(startDate, endDate, "p1");

    // Get available venues for this player within the date range
    const availableVenues: { Venue: string }[] = await prisma.$queryRaw`
    SELECT DISTINCT Venue 
    FROM poker_tournaments
    WHERE UID = ${playerUID}
    ${startDate ? Prisma.sql`AND ${dateCondition}` : Prisma.sql`AND 1=1`}
    ORDER BY Venue
  `;

    // Earliest game date query
    const earliestGameQuery = await prisma.$queryRaw<{ earliest_date: Date }[]>`
      SELECT MIN(game_date) as earliest_date
      FROM poker_tournaments
      WHERE UID = ${playerUID}
    `;

    const earliestGameDate =
      earliestGameQuery[0]?.earliest_date?.toISOString() || null;

    // Quarterly stats
    const quarterlyStats: {
      gamesPlayed: number;
      totalPoints: number;
      knockouts: number;
      finalTables: number;
      avgScore: number;
      finalTablePercentage: number;
    }[] = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as gamesPlayed,
      COALESCE(SUM(p1.Total_Points), 0) as totalPoints,
      COALESCE(SUM(p1.Knockouts), 0) as knockouts,
      COALESCE(SUM(CASE WHEN p1.Placement <= 8 THEN 1 ELSE 0 END), 0) as finalTables,
      COALESCE(CAST(AVG(p1.Player_Score) AS DECIMAL(10,2)), 0) as avgScore,
      COALESCE(CAST(
        (SUM(CASE WHEN p1.Placement <= 8 THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
        AS DECIMAL(10,2)
      ), 0) as finalTablePercentage
    FROM poker_tournaments p1
    LEFT JOIN players pl ON p1.UID = pl.uid
    WHERE p1.UID = ${playerUID}    
    ${startDate ? Prisma.sql`AND ${dateCondition}` : Prisma.sql`AND 1=1`}
    ${venueCondition}
  `;

    // Most Knocked Out By
    const knockedOutBy: {
      name: string;
      uid: string;
      nickname: string | null;
      count: number;
    }[] = await prisma.$queryRaw`
        SELECT 
          p2.Name as name,
          p2.UID as uid,
          pl.nickname,
          COUNT(*) as count
        FROM poker_tournaments p1
        JOIN poker_tournaments p2 ON p2.Name = p1.Hitman AND p2.File_name = p1.File_name
        LEFT JOIN players pl ON p2.UID = pl.uid
        WHERE p1.UID = ${playerUID}
        AND p1.Hitman IS NOT NULL
        ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
        ${venueCondition}
        GROUP BY p2.Name, p2.UID, pl.nickname
        ORDER BY count DESC
        LIMIT 3
      `;

    // Most Knocked Out
    const knockedOut: {
      name: string;
      uid: string;
      nickname: string | null;
      count: number;
    }[] = await prisma.$queryRaw`
  SELECT 
    p2.Name as name,
    p2.UID as uid,
    pl.nickname,
    COUNT(*) as count
  FROM poker_tournaments p1
  JOIN poker_tournaments p2 ON p2.File_name = p1.File_name AND p2.Hitman = p1.Name
  LEFT JOIN players pl ON p2.UID = pl.uid
  WHERE p1.UID = ${playerUID}
  ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
  ${venueCondition}
  GROUP BY p2.Name, p2.UID, pl.nickname
  ORDER BY count DESC
  LIMIT 3
`;

    // Venue Stats
    const venueStats: { venue: string; points: number }[] =
      await prisma.$queryRaw`
  SELECT 
    p1.Venue as venue,
    SUM(p1.Total_Points) as points
  FROM poker_tournaments p1
  WHERE p1.UID = ${playerUID}
  ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
  ${venueCondition}
  GROUP BY p1.Venue
  ORDER BY points DESC
`;

    // Recent Games
    const recentGames = await prisma.$queryRaw`
  SELECT 
    p1.game_date as date,
    p1.Venue as venue,
    p1.Placement as placement,
    p1.Total_Points as points,
    p1.Knockouts as knockouts,
    p1.File_name as fileName,
    p1.game_uid as game_uid
  FROM poker_tournaments p1
  WHERE p1.UID = ${playerUID}
  ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
  ${venueCondition}
  ORDER BY p1.game_date DESC
  LIMIT 50
`;

    // Placement Frequency
    const placementFrequency = await prisma.$queryRaw<
      { Placement: number; frequency: number }[]
    >`
      SELECT 
        Placement,
        COUNT(*) as frequency
      FROM poker_tournaments p1
      WHERE UID = ${playerUID}
      ${startDate ? Prisma.sql`AND ${dateConditionP1}` : Prisma.sql`AND 1=1`}
      ${venueCondition}
      AND Placement <= 8
      GROUP BY Placement
      ORDER BY Placement ASC
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
      availableVenues: availableVenues.map((v: any) => v.Venue),
      mostKnockedOutBy: knockedOutBy.map((ko: any) => ({
        name: ko.name,
        uid: ko.uid,
        nickname: ko.nickname,
        count: Number(ko.count),
      })),
      mostKnockedOut: knockedOut.map((ko: any) => ({
        name: ko.name,
        uid: ko.uid,
        nickname: ko.nickname,
        count: Number(ko.count),
      })),
      venueStats: venueStats.map((stat: any) => ({
        venue: stat.venue,
        points: Number(stat.points),
      })),
      recentGames,
      earliestGameDate,
      placementFrequency: placementFrequency.map((pf: any) => ({
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
