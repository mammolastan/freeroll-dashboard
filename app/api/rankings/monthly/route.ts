// app/api/rankings/monthly/route.ts
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getLeagueIdFromRequest } from "@/lib/league-utils";
import { getLeagueConfig } from "@/lib/league-config";
import { getLeagueNow, getLeagueMonthRange } from "@/lib/league-time";
import { getRankingsCacheTags } from "@/lib/rankings-cache";

interface VenueRanking {
  venue: string;
  rank: number;
  points: number;
}

interface PlayerRanking {
  name: string;
  uid: string;
  nickname?: string | null;
  qualifyingVenues: VenueRanking[];
  bubbleVenues: VenueRanking[];
  isQualified: boolean;
  isBubble: boolean;
}

function checkIfQualified(qualifyingVenues: VenueRanking[]): boolean {
  return qualifyingVenues.some((venue) => venue.rank <= 4);
}

// Core ranking calculation logic (shared by cached and uncached paths)
async function calculateMonthlyRankings(
  leagueId: number,
  startOfMonth: Date,
  endOfMonth: Date,
  targetDate: Date,
  periodId: number | null,
  periodName: string | null,
  timezone: string
) {
  // Build date condition
  const dateCondition = Prisma.sql`g.date >= DATE(${startOfMonth}) AND g.date <= DATE(${endOfMonth})`;

  // Get all venues for the month from the venues table
  const venues = await prisma.$queryRaw<{ name: string }[]>`
    SELECT DISTINCT v.name
    FROM venues v
    JOIN games g ON g.venue_id = v.id
    WHERE ${dateCondition}
    AND g.league_id = ${leagueId}
    AND v.name != 'bonus'
  `;

  // Get overall rankings (top 200)
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
      p.nickname,
      p.totalPoints,
      @rank := @rank + 1 as rank
    FROM (
      SELECT
        CONCAT(COALESCE(pl.first_name, ''), ' ', COALESCE(pl.last_name, '')) as name,
        pl.uid,
        pl.nickname,
        SUM(a.points + COALESCE(g.bonus_points, 0)) as totalPoints,
        AVG(a.player_score) as avgScore
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 pl ON pl.id = a.player_id
      WHERE ${dateCondition}
      AND g.league_id = ${leagueId}
      AND g.date IS NOT NULL
      AND a.placement IS NOT NULL
      AND v.name != 'bonus'
      GROUP BY pl.id, pl.uid, pl.first_name, pl.last_name, pl.nickname
      ORDER BY totalPoints DESC, avgScore DESC
    ) p,
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
            CONCAT(COALESCE(pl.first_name, ''), ' ', COALESCE(pl.last_name, '')) as name,
            pl.uid,
            SUM(a.points + COALESCE(g.bonus_points, 0)) as totalPoints,
            AVG(a.player_score) as avgScore
          FROM appearances a
          JOIN games g ON g.id = a.game_id
          JOIN venues v ON v.id = g.venue_id
          JOIN players_v2 pl ON pl.id = a.player_id
          WHERE ${dateCondition}
          AND g.league_id = ${leagueId}
          AND v.name = ${venue.name}
          GROUP BY pl.id, pl.uid, pl.first_name, pl.last_name
          ORDER BY totalPoints DESC, avgScore DESC
        ) ranked_venue_players,
        (SELECT @vrank := 0) r
        LIMIT 4
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
      if (playerAtVenue && playerAtVenue.rank <= 4) {
        qualifyingVenues.push({
          venue: venue.venue,
          rank: playerAtVenue.rank,
          points: Number(playerAtVenue.totalPoints),
        });
      }
    });

    return {
      name: player.name,
      nickname: player.nickname,
      uid: player.uid,
      qualifyingVenues,
      bubbleVenues,
      isQualified: checkIfQualified(qualifyingVenues),
      isBubble: false, // No longer using bubble classification
    };
  });

  return {
    rankings,
    month: periodName || targetDate.toLocaleString("default", {
      month: "long",
      timeZone: timezone,
    }),
    year: targetDate.getFullYear(),
    ...(periodId && { period_id: periodId }),
    ...(periodName && { period_name: periodName }),
    dateRange: {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString(),
    },
  };
}

// Cached function for period-based monthly rankings
async function fetchCachedMonthlyRankings(
  leagueId: number,
  periodId: number,
  timezone: string
) {
  const period = await prisma.competition_periods.findUnique({
    where: { id: periodId },
  });

  if (!period) {
    return { error: "Period not found" };
  }

  return calculateMonthlyRankings(
    leagueId,
    period.start_date,
    period.end_date,
    period.start_date,
    periodId,
    period.name,
    timezone
  );
}

// Create cached version with dynamic tags
function getCachedMonthlyRankings(leagueId: number, periodId: number, timezone: string) {
  const tags = getRankingsCacheTags(leagueId, "monthly");

  return unstable_cache(
    () => fetchCachedMonthlyRankings(leagueId, periodId, timezone),
    [`monthly-rankings-${leagueId}-${periodId}`],
    { tags }
  )();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = await getLeagueIdFromRequest(request);

    // Get league config for timezone
    const config = await getLeagueConfig(leagueId);
    const timezone = config.timezone;

    // Check for period_id first (new approach - cached)
    const periodIdParam = searchParams.get("period_id");

    if (periodIdParam) {
      const periodId = parseInt(periodIdParam);
      if (isNaN(periodId)) {
        return NextResponse.json(
          { error: "Invalid period_id parameter" },
          { status: 400 }
        );
      }

      const result = await getCachedMonthlyRankings(leagueId, periodId, timezone);

      if ("error" in result) {
        return NextResponse.json(
          { error: result.error },
          { status: 404 }
        );
      }

      return NextResponse.json(result);
    }

    // Legacy approach: currentMonth parameter (uncached - date-dependent)
    const isCurrentMonth = searchParams.get("currentMonth") !== "false";

    // Get the target date (current or previous month)
    const currentDate = getLeagueNow(timezone);
    const targetDate = isCurrentMonth
      ? currentDate
      : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

    // Get the date range for the target month
    const dateRange = getLeagueMonthRange(timezone, targetDate);

    const result = await calculateMonthlyRankings(
      leagueId,
      dateRange.startOfMonth,
      dateRange.endOfMonth,
      targetDate,
      null,
      null,
      timezone
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Monthly rankings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch monthly rankings" },
      { status: 500 }
    );
  }
}
