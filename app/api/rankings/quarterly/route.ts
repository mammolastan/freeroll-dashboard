// app/api/rankings/quarterly/route.ts
import { NextResponse } from "next/server";
import {
  getCurrentETDate,
  getQuarterDateRange,
} from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { Prisma } from "@prisma/client";
import { getLeagueIdFromRequest } from "@/lib/league-utils";

// Set revalidation period to 6 hours (in seconds)
export const revalidate = 21600; // 6 * 60 * 60 = 21600 seconds

function getCurrentQuarter(date: Date = new Date()): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

// Helper function to convert BigInt values
function serializeResults(results: RawQueryResult[]) {
  return results.map((record) => {
    const serialized = { ...record };
    for (const key in serialized) {
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
    const leagueId = await getLeagueIdFromRequest(request);

    // Check for period_id first (new approach)
    const periodIdParam = searchParams.get("period_id");

    let periodId: number | null = null;
    let periodName: string | null = null;
    let targetQuarter: number;
    let targetYear: number;
    let startOfQuarter: Date;
    let endOfQuarter: Date;

    if (periodIdParam) {
      // New period-based approach
      periodId = parseInt(periodIdParam);
      if (isNaN(periodId)) {
        return NextResponse.json(
          { error: "Invalid period_id parameter" },
          { status: 400 }
        );
      }

      // Look up the period
      const period = await prisma.competition_periods.findUnique({
        where: { id: periodId },
      });

      if (!period) {
        return NextResponse.json(
          { error: "Period not found" },
          { status: 404 }
        );
      }

      periodName = period.name;
      startOfQuarter = period.start_date;
      endOfQuarter = period.end_date;

      // Extract quarter and year from period name for response compatibility
      const match = period.name.match(/Q(\d)\s+(\d{4})/);
      if (match) {
        targetQuarter = parseInt(match[1]);
        targetYear = parseInt(match[2]);
      } else {
        // For non-standard period names, derive from dates
        targetQuarter = Math.floor(startOfQuarter.getMonth() / 3) + 1;
        targetYear = startOfQuarter.getFullYear();
      }
    } else {
      // Legacy approach: check for specific quarter and year parameters
      const quarterParam = searchParams.get("quarter");
      const yearParam = searchParams.get("year");

      if (quarterParam && yearParam) {
        // Use specific quarter and year from parameters
        targetQuarter = parseInt(quarterParam);
        targetYear = parseInt(yearParam);

        // Validate quarter (1-4) and year
        if (
          targetQuarter < 1 ||
          targetQuarter > 4 ||
          targetYear < 2020 ||
          targetYear > new Date().getFullYear() + 1
        ) {
          return NextResponse.json(
            { error: "Invalid quarter or year parameter" },
            { status: 400 }
          );
        }
      } else {
        // Fall back to the old currentQuarter logic for backward compatibility
        const isCurrentQuarter = searchParams.get("currentQuarter") !== "false";

        // Get current date in ET
        const currentDate = getCurrentETDate();
        const currentYear = currentDate.getFullYear();
        const currentQuarter = getCurrentQuarter(currentDate);

        // Determine target quarter and year
        targetQuarter = isCurrentQuarter
          ? currentQuarter
          : currentQuarter === 1
          ? 4
          : currentQuarter - 1;
        targetYear = isCurrentQuarter
          ? currentYear
          : currentQuarter === 1
          ? currentYear - 1
          : currentYear;
      }

      // Get date range for the quarter using legacy method
      const dateRange = getQuarterDateRange(targetQuarter, targetYear);
      startOfQuarter = dateRange.startOfQuarter;
      endOfQuarter = dateRange.endOfQuarter;
    }

    // Build the query - use game_periods join if period_id is provided, otherwise use date filter
    let players: RawQueryResult[];

    if (periodId) {
      // New approach: join via game_periods
      players = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
          p.uid,
          p.nickname,
          p.photo_url,
          COUNT(DISTINCT CASE WHEN v.name != 'bonus' THEN g.id END) as gamesPlayed,
          CAST(SUM(a.points) AS SIGNED) as totalPoints,
          CAST((
            SELECT COUNT(*) FROM knockouts k
            JOIN game_periods kgp ON kgp.game_id = k.game_id
            JOIN games kg ON kg.id = k.game_id
            JOIN venues kv ON kv.id = kg.venue_id
            WHERE k.hitman = p.id
            AND kv.name != 'bonus'
            AND kg.league_id = ${leagueId}
            AND kgp.period_id = ${periodId}
          ) AS SIGNED) as totalKnockouts,
          CAST(SUM(CASE WHEN a.placement <= 8 AND v.name != 'bonus' THEN 1 ELSE 0 END) AS SIGNED) as finalTables,
          CAST(AVG(CASE WHEN v.name != 'bonus' THEN a.player_score END) AS DECIMAL(10,2)) as avgScore,
          (SELECT ROUND(AVG(rating), 1) FROM player_reviews WHERE reviewed_uid COLLATE utf8mb4_unicode_ci = p.uid AND league_id = ${leagueId}) AS review_avg,
          (SELECT COUNT(*) FROM player_reviews WHERE reviewed_uid COLLATE utf8mb4_unicode_ci = p.uid AND league_id = ${leagueId}) AS review_count
        FROM game_periods gp
        JOIN games g ON g.id = gp.game_id
        JOIN appearances a ON a.game_id = g.id
        JOIN venues v ON v.id = g.venue_id
        JOIN players_v2 p ON p.id = a.player_id
        WHERE gp.period_id = ${periodId}
        AND g.league_id = ${leagueId}
        GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname, p.photo_url
        HAVING gamesPlayed >= 1
        ORDER BY totalPoints DESC
      `;
    } else {
      // Legacy approach: date-based filtering
      const dateCondition = Prisma.sql`g.date >= DATE(${startOfQuarter}) AND g.date <= DATE(${endOfQuarter})`;

      players = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT
          CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
          p.uid,
          p.nickname,
          p.photo_url,
          COUNT(DISTINCT CASE WHEN v.name != 'bonus' THEN g.id END) as gamesPlayed,
          CAST(SUM(a.points) AS SIGNED) as totalPoints,
          CAST((
            SELECT COUNT(*) FROM knockouts k
            JOIN games kg ON kg.id = k.game_id
            JOIN venues kv ON kv.id = kg.venue_id
            WHERE k.hitman = p.id
            AND kv.name != 'bonus'
            AND kg.league_id = ${leagueId}
            AND kg.date >= DATE(${startOfQuarter}) AND kg.date <= DATE(${endOfQuarter})
          ) AS SIGNED) as totalKnockouts,
          CAST(SUM(CASE WHEN a.placement <= 8 AND v.name != 'bonus' THEN 1 ELSE 0 END) AS SIGNED) as finalTables,
          CAST(AVG(CASE WHEN v.name != 'bonus' THEN a.player_score END) AS DECIMAL(10,2)) as avgScore,
          (SELECT ROUND(AVG(rating), 1) FROM player_reviews WHERE reviewed_uid COLLATE utf8mb4_unicode_ci = p.uid AND league_id = ${leagueId}) AS review_avg,
          (SELECT COUNT(*) FROM player_reviews WHERE reviewed_uid COLLATE utf8mb4_unicode_ci = p.uid AND league_id = ${leagueId}) AS review_count
        FROM appearances a
        JOIN games g ON g.id = a.game_id
        JOIN venues v ON v.id = g.venue_id
        JOIN players_v2 p ON p.id = a.player_id
        WHERE ${dateCondition}
        AND g.league_id = ${leagueId}
        GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname, p.photo_url
        HAVING gamesPlayed >= 1
        ORDER BY totalPoints DESC
      `;
    }

    // Serialize the results and add rankings
    const serializedPlayers = serializeResults(players);
    const rankings = serializedPlayers.map((player, index) => {
      const gamesPlayed = Number(player.gamesPlayed) || 0;
      const finalTables = Number(player.finalTables) || 0;
      const totalPoints = Number(player.totalPoints) || 0;

      return {
        ...player,
        ranking: index + 1,
        isQualified: index < 40, // Top 40 players qualify
        // Convert photo_url to photoUrl (camelCase)
        photoUrl: player.photo_url,
        // Ensure avgScore is properly converted to number
        avgScore: player.avgScore ? Number(player.avgScore) : 0,
        // Calculate FTP and PPG in JavaScript to ensure they're properly calculated
        finalTablePercentage:
          gamesPlayed > 0
            ? Number(((finalTables / gamesPlayed) * 100).toFixed(2))
            : 0,
        pointsPerGame:
          gamesPlayed > 0
            ? Number((totalPoints / gamesPlayed).toFixed(2))
            : 0,
        // Review data
        reviewAvg: player.review_avg ? Number(player.review_avg) : 0,
        reviewCount: Number(player.review_count) || 0,
      };
    });

    // Return the results with quarter and year
    return NextResponse.json({
      rankings,
      quarter: targetQuarter,
      year: targetYear,
      ...(periodId && { period_id: periodId }),
      ...(periodName && { period_name: periodName }),
      dateRange: {
        start: startOfQuarter.toISOString(),
        end: endOfQuarter.toISOString(),
      },
    });
  } catch (error) {
    console.error("Quarterly rankings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quarterly rankings" },
      { status: 500 }
    );
  }
}
