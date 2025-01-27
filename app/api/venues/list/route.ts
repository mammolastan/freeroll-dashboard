// app/api/venues/list/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  getCurrentETDate,
  getMonthDateRange,
  getDateCondition,
} from "@/lib/utils";

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

function getMonthYearString(date: Date) {
  return {
    month: date.toLocaleString("default", { month: "long", timeZone: "UTC" }),
    year: date.getUTCFullYear(),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    // Get current date in ET
    const currentDate = getCurrentETDate();

    const targetDate = isCurrentMonth
      ? currentDate
      : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

    // Get date range for the month
    const { startOfMonth, endOfMonth } = getMonthDateRange(targetDate);
    const dateCondition = getDateCondition(startOfMonth, endOfMonth);

    const { month, year } = getMonthYearString(targetDate);

    // First get all venues
    const venues = await prisma.$queryRaw`
      SELECT DISTINCT 
        Venue as name,
        COUNT(DISTINCT File_name) as totalGames
      FROM poker_tournaments
      WHERE ${dateCondition}
      GROUP BY Venue
      ORDER BY totalGames DESC
    `;

    // Then for each venue, get top 5 players
    const venuesWithPlayers = await Promise.all(
      (venues as any[]).map(async (venue) => {
        const topPlayers = await prisma.$queryRaw`
          SELECT 
            Name as name,
            UID as uid,
            SUM(Total_Points) as totalPoints,
            SUM(Knockouts) as knockouts,
            COUNT(*) as gamesPlayed
          FROM poker_tournaments
          WHERE Venue = ${venue.name}
          AND TRIM(Season) IN (${`${month} ${year}`}, ${`${month}  ${year}`})
          GROUP BY Name, UID
          ORDER BY totalPoints DESC
          LIMIT 5
        `;

        return {
          ...venue,
          topPlayers: serializeResults(topPlayers as any[]),
        };
      })
    );

    return NextResponse.json({
      venues: serializeResults(venuesWithPlayers),
      month,
      year,
    });
  } catch (error) {
    console.error("Venue list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}
