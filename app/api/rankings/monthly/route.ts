// app/api/rankings/monthly/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

interface VenueRanking {
  venue: string;
  rank: number;
}

interface PlayerRanking {
  rank: number;
  name: string;
  uid: string;
  totalPoints: number;
  qualifyingVenues: VenueRanking[];
  bubbleVenues: VenueRanking[];
  isQualified: boolean;
  isBubble: boolean;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    const currentDate = new Date();
    const targetDate = isCurrentMonth
      ? currentDate
      : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

    const month = targetDate.toLocaleString("default", {
      month: "long",
      timeZone: "UTC",
    });
    const year = targetDate.getUTCFullYear();

    // Get all venues for the month
    const venues = await prisma.$queryRaw<{ name: string }[]>`
      SELECT DISTINCT Venue as name
      FROM poker_tournaments
      WHERE TRIM(Season) IN (${`${month} ${year}`}, ${`${month}  ${year}`})
    `;

    // Get overall rankings (top 50)
    const overallRankings = await prisma.$queryRaw<
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
        @rank := @rank + 1 as rank
      FROM (
        SELECT 
          Name as name,
          UID as uid,
          SUM(Total_Points) as totalPoints
        FROM poker_tournaments
        WHERE TRIM(Season) IN (${`${month} ${year}`}, ${`${month}  ${year}`})
        GROUP BY Name, UID
        ORDER BY totalPoints DESC
      ) ranked_players,
      (SELECT @rank := 0) r
      LIMIT 50
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
              SUM(Total_Points) as totalPoints
            FROM poker_tournaments
            WHERE TRIM(Season) IN (${`${month} ${year}`}, ${`${month}  ${year}`})
            AND Venue = ${venue.name}
            GROUP BY Name, UID
            ORDER BY totalPoints DESC
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
          if (playerAtVenue.rank <= 5) {
            qualifyingVenues.push({
              venue: venue.venue,
              rank: playerAtVenue.rank,
            });
          } else if (playerAtVenue.rank <= 7) {
            bubbleVenues.push({
              venue: venue.venue,
              rank: playerAtVenue.rank,
            });
          }
        }
      });

      return {
        rank: Number(player.rank),
        name: player.name,
        uid: player.uid,
        totalPoints: Number(player.totalPoints),
        qualifyingVenues,
        bubbleVenues,
        isQualified: qualifyingVenues.length > 0,
        isBubble: qualifyingVenues.length === 0 && bubbleVenues.length > 0,
      };
    });

    return NextResponse.json({
      rankings,
      month,
      year,
    });
  } catch (error) {
    console.error("Monthly rankings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch monthly rankings" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
