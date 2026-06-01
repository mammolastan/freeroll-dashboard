// app/api/rankings/quarterly/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { getLeagueIdFromRequest } from "@/lib/league-utils";

// Set revalidation period to 6 hours (in seconds)
export const revalidate = 21600; // 6 * 60 * 60 = 21600 seconds

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

    const periodIdParam = searchParams.get("period_id");

    if (!periodIdParam) {
      return NextResponse.json(
        { error: "period_id parameter is required" },
        { status: 400 }
      );
    }

    const periodId = parseInt(periodIdParam);
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

    // Extract quarter and year from period name for response compatibility
    let targetQuarter: number;
    let targetYear: number;
    const match = period.name.match(/Q(\d)\s+(\d{4})/);
    if (match) {
      targetQuarter = parseInt(match[1]);
      targetYear = parseInt(match[2]);
    } else {
      // For non-standard period names, derive from dates
      targetQuarter = Math.floor(period.start_date.getMonth() / 3) + 1;
      targetYear = period.start_date.getFullYear();
    }

    // Query rankings using game_periods to only include explicitly assigned games
    const players = await prisma.$queryRaw<RawQueryResult[]>`
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

    // Return the results
    return NextResponse.json({
      rankings,
      quarter: targetQuarter,
      year: targetYear,
      period_id: periodId,
      period_name: period.name,
      dateRange: {
        start: period.start_date.toISOString(),
        end: period.end_date.toISOString(),
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
