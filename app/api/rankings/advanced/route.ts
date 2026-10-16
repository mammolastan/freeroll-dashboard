// app/api/rankings/advanced/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { getLeagueIdFromRequest } from "@/lib/league-utils";

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

    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const venue = searchParams.get("venue");

    // Parse dates
    const startDate = startDateParam && startDateParam !== "null"
      ? new Date(startDateParam)
      : null;
    const endDate = endDateParam && endDateParam !== "null"
      ? new Date(endDateParam)
      : null;

    // Build date conditions
    const dateConditions: Prisma.Sql[] = [];
    if (startDate) {
      dateConditions.push(Prisma.sql`g.date >= DATE(${startDate})`);
    }
    if (endDate) {
      dateConditions.push(Prisma.sql`g.date <= DATE(${endDate})`);
    }
    const dateCondition = dateConditions.length > 0
      ? Prisma.sql`AND ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    // Venue condition
    const venueCondition = venue && venue !== "all"
      ? Prisma.sql`AND v.name = ${venue}`
      : Prisma.sql``;

    // Query rankings with arbitrary date filtering
    const players = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
        p.uid,
        p.nickname,
        p.photo_url,
        COUNT(DISTINCT CASE WHEN v.name != 'bonus' THEN g.id END) as gamesPlayed,
        CAST(SUM(a.points + COALESCE(g.bonus_points, 0)) AS SIGNED) as totalPoints,
        CAST(SUM(CASE WHEN v.name != 'bonus' THEN a.points ELSE 0 END) AS SIGNED) as placementPoints,
        CAST(SUM(CASE WHEN v.name != 'bonus' THEN COALESCE(g.bonus_points, 0) ELSE 0 END) AS SIGNED) as bonusPoints,
        CAST((
          SELECT COUNT(*) FROM knockouts k
          JOIN games kg ON kg.id = k.game_id
          JOIN venues kv ON kv.id = kg.venue_id
          WHERE k.hitman = p.id
          AND kv.name != 'bonus'
          AND kg.league_id = ${leagueId}
          ${startDate ? Prisma.sql`AND kg.date >= DATE(${startDate})` : Prisma.sql``}
          ${endDate ? Prisma.sql`AND kg.date <= DATE(${endDate})` : Prisma.sql``}
          ${venue && venue !== "all" ? Prisma.sql`AND kv.name = ${venue}` : Prisma.sql``}
        ) AS SIGNED) as totalKnockouts,
        CAST(SUM(CASE WHEN a.placement <= 8 AND v.name != 'bonus' THEN 1 ELSE 0 END) AS SIGNED) as finalTables,
        CAST(AVG(CASE WHEN v.name != 'bonus' THEN a.player_score END) AS DECIMAL(10,2)) as avgScore
      FROM games g
      JOIN appearances a ON a.game_id = g.id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE g.league_id = ${leagueId}
      ${dateCondition}
      ${venueCondition}
      GROUP BY p.id, p.uid, p.first_name, p.last_name, p.nickname, p.photo_url
      HAVING gamesPlayed >= 1
      ORDER BY totalPoints DESC
    `;

    // Serialize the results and add rankings with computed metrics
    const serializedPlayers = serializeResults(players);
    const rankings = serializedPlayers.map((player, index) => {
      const gamesPlayed = Number(player.gamesPlayed) || 0;
      const finalTables = Number(player.finalTables) || 0;
      const totalPoints = Number(player.totalPoints) || 0;
      const placementPoints = Number(player.placementPoints) || 0;

      return {
        ...player,
        ranking: index + 1,
        photoUrl: player.photo_url,
        avgScore: player.avgScore ? Number(player.avgScore) : 0,
        finalTablePercentage:
          gamesPlayed > 0
            ? Number(((finalTables / gamesPlayed) * 100).toFixed(2))
            : 0,
        pointsPerGame:
          gamesPlayed > 0
            ? Number((totalPoints / gamesPlayed).toFixed(2))
            : 0,
        placementPPG:
          gamesPlayed > 0
            ? Number((placementPoints / gamesPlayed).toFixed(2))
            : 0,
      };
    });

    return NextResponse.json({
      rankings,
      filters: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        venue: venue || "all",
      },
    });
  } catch (error) {
    console.error("Advanced rankings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch advanced rankings" },
      { status: 500 }
    );
  }
}
