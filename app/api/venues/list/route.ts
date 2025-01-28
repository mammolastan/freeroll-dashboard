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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    // Get current date in ET
    const currentDate = getCurrentETDate();

    // For previous month logic, ensure we're using ET dates
    const targetDate = isCurrentMonth
      ? currentDate
      : new Date(
          currentDate.toLocaleString("en-US", {
            timeZone: "America/New_York",
            year: "numeric",
            month: "numeric",
            day: "numeric",
          })
        );

    if (!isCurrentMonth) {
      targetDate.setMonth(targetDate.getMonth() - 1);
    }

    // Get date range for the month
    const { startOfMonth, endOfMonth } = getMonthDateRange(targetDate);
    const dateCondition = getDateCondition(startOfMonth, endOfMonth);

    // Get the month and year in ET
    const month = targetDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "long",
    });
    const year = targetDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
    });

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
          AND ${dateCondition}
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
      year: parseInt(year),
    });
  } catch (error) {
    console.error("Venue list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}
