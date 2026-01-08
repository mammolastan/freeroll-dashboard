// app/api/rankings/monthly/route.ts
import { NextResponse } from "next/server";
import {
  getCurrentETDate,
  getMonthDateRange,
  getDateCondition,
} from "@/lib/utils";
import { prisma } from "@/lib/prisma";

// Set revalidation period to 6 hours (in seconds)
export const revalidate = 21600; // 6 * 60 * 60 = 21600 seconds

interface VenueRanking {
  venue: string;
  rank: number;
  points: number;
}

interface PlayerRanking {
  name: string;
  uid: string;
  qualifyingVenues: VenueRanking[];
  bubbleVenues: VenueRanking[];
  isQualified: boolean;
  isBubble: boolean;
}

function checkIfQualified(qualifyingVenues: VenueRanking[]): boolean {
  return qualifyingVenues.some((venue) => venue.rank < 6);
}

function checkIfBubble(qualifyingVenues: VenueRanking[]): boolean {
  return qualifyingVenues.some((venue) => venue.rank > 5);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    // Get the target date (current or previous month)
    const currentDate = getCurrentETDate();
    const targetDate = isCurrentMonth
      ? currentDate
      : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

    // Get the date range for the target month
    const { startOfMonth, endOfMonth } = getMonthDateRange(targetDate);
    const dateCondition = getDateCondition(startOfMonth, endOfMonth);

    // Get all venues for the month
    const venues = await prisma.$queryRaw<{ name: string }[]>`
     SELECT DISTINCT Venue as name
     FROM poker_tournaments
     WHERE ${dateCondition}
     AND Venue != 'bonus'
   `;

    // Get overall rankings (top 50)
    const overallRankings = await prisma.$queryRaw<
      {
        name: string;
        uid: string;
        totalPoints: bigint;
        rank: bigint;
        nickname: string | null;
      }[]
    >`
          SELECT 
        p.name,
        p.uid,
        pl.nickname,
        p.totalPoints,
        @rank := @rank + 1 as rank
      FROM (
        SELECT 
          Name as name,
          UID as uid,
          SUM(Total_Points) as totalPoints,
          AVG(Player_Score) as avgScore
        FROM poker_tournaments
        WHERE ${dateCondition}
        AND game_date IS NOT NULL
        AND Placement IS NOT NULL
        AND Venue != 'bonus'
        GROUP BY Name, UID
        ORDER BY totalPoints DESC, avgScore DESC
      ) p
      LEFT JOIN players pl ON p.uid = pl.uid,
      (SELECT @rank := 0) r
      LIMIT 200
    `;

    // For each venue, get player rankings
    const venueRankings = await Promise.all(
      venues.map(async (venue) => {
        const rankings = await prisma.$queryRaw<
          {
            name: string;
            uid: string;
            totalPoints: bigint;
            rank: bigint;
          }[]
        >`
          SELECT 
            name,
            uid,
            totalPoints,
            @vrank := @vrank + 1 as rank
          FROM (
            SELECT 
              Name as name,
              UID as uid,
              SUM(Total_Points) as totalPoints,
              AVG(Player_Score) as avgScore
            FROM poker_tournaments
            WHERE ${dateCondition}
            AND Venue = ${venue.name}
            GROUP BY Name, UID
            ORDER BY totalPoints DESC, avgScore DESC
          ) ranked_venue_players,
          (SELECT @vrank := 0) r
          LIMIT 7
        `;

        return {
          venue: venue.name,
          rankings: rankings.map((r) => ({
            ...r,
            rank: Number(r.rank),
            totalPoints: Number(r.totalPoints),
          })),
        };
      })
    );

    // Combine data to create final rankings
    const rankings: PlayerRanking[] = overallRankings.map((player) => {
      const qualifyingVenues: VenueRanking[] = [];
      const bubbleVenues: VenueRanking[] = [];

      // Check each venue for qualification status
      venueRankings.forEach((venue) => {
        const playerAtVenue = venue.rankings.find((r) => r.uid === player.uid);
        if (playerAtVenue) {
          if (playerAtVenue.rank <= 7) {
            qualifyingVenues.push({
              venue: venue.venue,
              rank: playerAtVenue.rank,
              points: Number(playerAtVenue.totalPoints),
            });
          }
        }
      });

      return {
        name: player.name,
        nickname: player.nickname,
        uid: player.uid,
        qualifyingVenues,
        bubbleVenues,
        isQualified: checkIfQualified(qualifyingVenues),
        isBubble: checkIfBubble(qualifyingVenues),
      };
    });

    // Return the results with the month and year from the target date
    return NextResponse.json({
      rankings,
      month: targetDate.toLocaleString("default", {
        month: "long",
        timeZone: "America/New_York",
      }),
      year: targetDate.getFullYear(),
    });
  } catch (error) {
    console.error("Monthly rankings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch monthly rankings" },
      { status: 500 }
    );
  }
}
