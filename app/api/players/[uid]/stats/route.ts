import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Interfaces for query results
interface QuarterlyStats {
  gamesPlayed: bigint;
  totalPoints: bigint;
  knockouts: bigint;
  finalTables: bigint;
  avgScore: number;
}

interface KnockedOutStats {
  name: string;
  count: bigint;
}

interface VenueStats {
  venue: string;
  points: bigint;
}

interface RecentGame {
  date: string;
  venue: string;
  placement: number;
  points: number;
  knockouts: number;
}

// Helper function to convert BigInt to number
function formatStats(stats: QuarterlyStats) {
  return {
    gamesPlayed: Number(stats.gamesPlayed),
    totalPoints: Number(stats.totalPoints),
    knockouts: Number(stats.knockouts),
    finalTables: Number(stats.finalTables),
    avgScore: stats.avgScore,
  };
}

// Helper function to create the date filtering condition

function getDateCondition(
  startDate: Date | null,
  endDate: Date | null,
  tableAlias?: string
) {
  console.log("in getDateCondition");
  console.log("startDate", startDate);
  if (!startDate) {
    return Prisma.empty; // This is a special Prisma SQL template that resolves to an empty string
  }

  const seasonColumn = tableAlias
    ? `${tableAlias}.Season`
    : "poker_tournaments.Season";

  // Always log these details
  console.log("Date Condition Input:", {
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    startMonth: startDate?.getMonth(),
    startYear: startDate?.getFullYear(),
    endMonth: endDate?.getMonth(),
    endYear: endDate?.getFullYear(),
  });
  // Adjust month to account for 0-based indexing
  const adjustedStartMonth = startDate.getMonth() + 1;
  const adjustedEndMonth = endDate ? endDate.getMonth() + 1 : null;

  console.log("Adjusted Date Condition Input:", {
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    adjustedStartMonth,
    adjustedEndMonth,
    startYear: startDate?.getFullYear(),
    endYear: endDate?.getFullYear(),
  });

  // Special handling for current month

  if (
    endDate &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    const month = startDate.toLocaleString("default", {
      month: "long",
      timeZone: "UTC",
    });
    const year = startDate.getUTCFullYear();

    return Prisma.sql`
  TRIM(${Prisma.raw(
    seasonColumn
  )}) IN (${`${month} ${year}`}, ${`${month}  ${year}`})
`;
  }

  // Create a standardized version of the date string for comparison
  const dateExpr = Prisma.sql`STR_TO_DATE(
    CONCAT(
      SUBSTRING_INDEX(REPLACE(REPLACE(${Prisma.raw(
        seasonColumn
      )}, '  ', ' '), '   ', ' '), ' ', 1),
      ' ',
      SUBSTRING_INDEX(REPLACE(REPLACE(${Prisma.raw(
        seasonColumn
      )}, '  ', ' '), '   ', ' '), ' ', -1)
    ),
    '%M %Y'
  )`;

  if (endDate) {
    return Prisma.sql`${dateExpr} >= ${startDate} AND ${dateExpr} <= ${endDate}`;
  }

  return Prisma.sql`${dateExpr} >= ${startDate}`;
}

// Helper function to parse the game date from the file name
function parseGameDate(fileName: string, seasonYear: string): Date {
  // Extract the date portion (e.g., "0104" from "0104_urbT_bb.tdt")
  const datePart = fileName.split("_")[0];

  // Parse month and day
  const month = parseInt(datePart.substring(0, 2)) - 1; // Subtract 1 as months are 0-based
  const day = parseInt(datePart.substring(2, 4));
  const year = parseInt(seasonYear);

  return new Date(year, month, day);
}

export async function GET(
  request: Request,
  { params }: { params: { uid: string } }
) {
  try {
    console.log("GET /api/players/[uid]/stats");

    const { searchParams } = new URL(request.url);
    console.log("searchParams", searchParams);
    const playerUID = params.uid;
    console.log("playerUID", playerUID);
    console.log("after playerUID");
    console.log(searchParams.get("startDate"));

    const startDateParam = searchParams.get("startDate");
    console.log("startDateParam", startDateParam);
    const endDateParam = searchParams.get("endDate");
    console.log("endDateParam", endDateParam);
    const startDate =
      startDateParam === "null"
        ? null
        : startDateParam
        ? new Date(startDateParam)
        : null;
    const endDate =
      endDateParam === "null"
        ? null
        : endDateParam
        ? new Date(endDateParam)
        : null;

    console.log("startDate", startDate);
    console.log("endDate", endDate);
    // If it's an all-time query, find the earliest game date
    let earliestGameDate = null;

    if (!startDate) {
      const earliestGame = await prisma.$queryRaw<{ Season: string }[]>`
        SELECT Season
        FROM poker_tournaments
        WHERE UID = ${playerUID}
        ORDER BY STR_TO_DATE(
          TRIM(REPLACE(Season, '  ', ' ')),
          '%M %Y'
        ) ASC
        LIMIT 1
      `;

      if (earliestGame.length > 0) {
        // Parse the season string to create a valid date (first day of the month)
        const seasonParts = earliestGame[0].Season.trim().split(/\s+/);
        const month = seasonParts[0]; // e.g., "April"
        const year = seasonParts[1]; // e.g., "2022"
        earliestGameDate = new Date(
          Date.UTC(
            parseInt(year),
            new Date(`${month} 1, ${year}`).getMonth(),
            1
          )
        );
      }
    }

    console.log("Player UID:", playerUID);
    console.log("Start Date:", startDate?.toISOString());
    console.log("End Date:", endDate?.toISOString());
    console.log(
      "Date Condition Generated:",
      getDateCondition(startDate, endDate).toString()
    );

    // Add this query to check raw data
    const rawDataCheck = await prisma.$queryRaw`
  SELECT * 
  FROM poker_tournaments 
  WHERE UID = ${playerUID}
  AND (
    TRIM(Season) = 'December  2024' OR 
    TRIM(Season) = 'December 2024'
  )
`;
    console.log("Raw Data Check:", rawDataCheck);

    const seasonMatchCheck = await prisma.$queryRaw`
    SELECT * 
    FROM poker_tournaments 
    WHERE UID = ${playerUID}
    AND (
      Season = 'December  2024' OR
      Season LIKE '%December%2024%'
    )
  `;
    console.log("Season Match Check:", seasonMatchCheck);

    // Quarterly Stats
    const quarterlyStats = await prisma.$queryRaw<QuarterlyStats[]>`
    SELECT 
      COUNT(*) as gamesPlayed,
      COALESCE(SUM(Total_Points), 0) as totalPoints,
      COALESCE(SUM(Knockouts), 0) as knockouts,
      COALESCE(SUM(CASE WHEN Placement <= 8 THEN 1 ELSE 0 END), 0) as finalTables,
      COALESCE(CAST(AVG(Player_Score) AS DECIMAL(10,2)), 0) as avgScore
    FROM poker_tournaments
    WHERE UID = ${playerUID}
    ${
      startDate
        ? Prisma.sql`AND ${getDateCondition(startDate, endDate)}`
        : Prisma.sql`AND 1=1`
    }
    `;

    // Most Knocked Out By
    const knockedOutBy = await prisma.$queryRaw<KnockedOutStats[]>`
      SELECT 
        Hitman as name,
        COUNT(*) as count
      FROM poker_tournaments
      WHERE UID = ${playerUID}
      AND Hitman IS NOT NULL
      ${
        startDate
          ? Prisma.sql`AND ${getDateCondition(startDate, endDate)}`
          : Prisma.sql`AND 1=1`
      }
      GROUP BY Hitman
      ORDER BY count DESC
      LIMIT 3
      `;

    // Most Knocked Out
    const knockedOut = await prisma.$queryRaw<KnockedOutStats[]>`
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

    // Venue Stats
    const venueStats = await prisma.$queryRaw<VenueStats[]>`
      SELECT 
        Venue as venue,
        SUM(Total_Points) as points
      FROM poker_tournaments
      WHERE UID = ${playerUID}
      ${
        startDate
          ? Prisma.sql`AND ${getDateCondition(startDate, endDate)}`
          : Prisma.sql`AND 1=1`
      }
      GROUP BY Venue
      ORDER BY points DESC
      `;

    // Recent Games
    const recentGames = await prisma.$queryRaw<RecentGame[]>`
SELECT 
  Season as date,
  Venue as venue,
  Placement as placement,
  Total_Points as points,
  Knockouts as knockouts,
  File_name as fileName
FROM poker_tournaments
WHERE UID = ${playerUID}
${
  startDate
    ? Prisma.sql`AND ${getDateCondition(startDate, endDate)}`
    : Prisma.sql`AND 1=1`
}
ORDER BY STR_TO_DATE(CONCAT(SUBSTRING_INDEX(Season, ' ', 1), ' ', SUBSTRING_INDEX(Season, ' ', -1)), '%M %Y') DESC,
         File_name DESC
LIMIT 5
`;

    const response = {
      quarterlyStats: {
        gamesPlayed: quarterlyStats[0]
          ? Number(quarterlyStats[0].gamesPlayed)
          : 0,
        totalPoints: quarterlyStats[0]
          ? Number(quarterlyStats[0].totalPoints)
          : 0,
        knockouts: quarterlyStats[0] ? Number(quarterlyStats[0].knockouts) : 0,
        finalTables: quarterlyStats[0]
          ? Number(quarterlyStats[0].finalTables)
          : 0,
        avgScore: quarterlyStats[0] ? Number(quarterlyStats[0].avgScore) : 0,
      },
      mostKnockedOutBy: knockedOutBy.map((ko) => ({
        name: ko.name,
        count: Number(ko.count),
      })),
      mostKnockedOut: knockedOut.map((ko) => ({
        name: ko.name,
        count: Number(ko.count),
      })),
      venueStats: venueStats.map((stat) => ({
        venue: stat.venue,
        points: Number(stat.points),
      })),
      recentGames: recentGames,
      earliestGameDate: earliestGameDate
        ? earliestGameDate.toISOString()
        : null,
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
