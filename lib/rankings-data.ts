// lib/rankings-data.ts
// Server-side data fetching functions for rankings pages

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { RawQueryResult } from "@/types";
import { getRankingsCacheTags } from "@/lib/rankings-cache";
import type { BadgeData } from "@/components/ui/Badge";

// Re-export BadgeData for consumers
export type { BadgeData };

// Types
export interface CompetitionPeriod {
  id: number;
  name: string;
  period_type: string;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  display_order: number;
}

export interface PlayerRanking {
  name: string;
  uid: string;
  gamesPlayed: number;
  totalPoints: number;
  totalKnockouts: number;
  finalTables: number;
  avgScore: number;
  finalTablePercentage: number;
  pointsPerGame: number;
  ranking: number;
  isQualified: boolean;
  nickname: string | null;
  photoUrl: string | null;
  badges?: BadgeData[];
  reviewAvg?: number;
  reviewCount?: number;
}

export interface RankingsData {
  rankings: PlayerRanking[];
  quarter: number;
  year: number;
  period_id: number;
  period_name: string;
  period_type: string;
  dateRange: {
    start: string;
    end: string;
  };
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

// Fetch competition periods for a league
async function fetchPeriodsInternal(
  leagueId: number,
  periodType: string
): Promise<CompetitionPeriod[]> {
  const periods = await prisma.competition_periods.findMany({
    where: {
      league_id: leagueId,
      period_type: periodType,
      is_active: true,
    },
    orderBy: {
      display_order: "desc",
    },
    select: {
      id: true,
      name: true,
      period_type: true,
      start_date: true,
      end_date: true,
      is_active: true,
      display_order: true,
    },
  });

  return periods;
}

// Cached version of fetchPeriods
export function getCachedCompetitionPeriods(
  leagueId: number,
  periodType: string
) {
  return unstable_cache(
    () => fetchPeriodsInternal(leagueId, periodType),
    [`competition-periods-${leagueId}-${periodType}`],
    {
      tags: [`periods-${leagueId}`, `rankings-all-${leagueId}`],
      revalidate: 3600, // 1 hour
    }
  )();
}

// Fetch rankings for a period (extracted from API route)
async function fetchPeriodRankingsInternal(
  leagueId: number,
  periodId: number
): Promise<RankingsData | { error: string }> {
  const period = await prisma.competition_periods.findUnique({
    where: { id: periodId },
  });

  if (!period) {
    return { error: "Period not found" };
  }

  // Extract quarter and year from period name for response compatibility
  let targetQuarter: number;
  let targetYear: number;
  const match = period.name.match(/Q(\d)\s+(\d{4})/);
  if (match) {
    targetQuarter = parseInt(match[1]);
    targetYear = parseInt(match[2]);
  } else {
    targetQuarter = Math.floor(period.start_date.getMonth() / 3) + 1;
    targetYear = period.start_date.getFullYear();
  }

  // Query rankings
  const players = await prisma.$queryRaw<RawQueryResult[]>`
    SELECT
      CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
      p.uid,
      p.nickname,
      p.photo_url,
      COUNT(DISTINCT CASE WHEN v.name != 'bonus' THEN g.id END) as gamesPlayed,
      CAST(SUM(a.points + COALESCE(g.bonus_points, 0)) AS SIGNED) as totalPoints,
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

  const serializedPlayers = serializeResults(players);
  const rankings: PlayerRanking[] = serializedPlayers.map((player, index) => {
    const gamesPlayed = Number(player.gamesPlayed) || 0;
    const finalTables = Number(player.finalTables) || 0;
    const totalPoints = Number(player.totalPoints) || 0;

    return {
      name: player.name as string,
      uid: player.uid as string,
      nickname: player.nickname as string | null,
      photoUrl: player.photo_url as string | null,
      gamesPlayed,
      totalPoints,
      totalKnockouts: Number(player.totalKnockouts) || 0,
      finalTables,
      avgScore: player.avgScore ? Number(player.avgScore) : 0,
      ranking: index + 1,
      isQualified: index < 40,
      finalTablePercentage:
        gamesPlayed > 0
          ? Number(((finalTables / gamesPlayed) * 100).toFixed(2))
          : 0,
      pointsPerGame:
        gamesPlayed > 0 ? Number((totalPoints / gamesPlayed).toFixed(2)) : 0,
      reviewAvg: player.review_avg ? Number(player.review_avg) : 0,
      reviewCount: Number(player.review_count) || 0,
    };
  });

  return {
    rankings,
    quarter: targetQuarter,
    year: targetYear,
    period_id: periodId,
    period_name: period.name,
    period_type: period.period_type,
    dateRange: {
      start: period.start_date.toISOString(),
      end: period.end_date.toISOString(),
    },
  };
}

// Cached version of fetchPeriodRankings
export function getCachedPeriodRankings(
  leagueId: number,
  periodId: number,
  periodType: string
) {
  const tags = getRankingsCacheTags(leagueId, periodType);

  return unstable_cache(
    () => fetchPeriodRankingsInternal(leagueId, periodId),
    [`period-rankings-${leagueId}-${periodId}`],
    { tags }
  )();
}

// Fetch badges for multiple players
async function fetchBadgesBatchInternal(
  playerUids: string[]
): Promise<Record<string, BadgeData[]>> {
  if (playerUids.length === 0) {
    return {};
  }

  // Limit to 400 UIDs
  const limitedUids = playerUids.slice(0, 400);

  const batchBadges = await prisma.$queryRaw<RawQueryResult[]>`
    SELECT
      pb.player_uid,
      pb.id,
      b.quote,
      b.criteria,
      b.short_description,
      b.long_description,
      b.icon,
      b.rarity,
      b.tier,
      pb.earned_at,
      pb.expiration,
      pb.description
    FROM player_badges pb
    JOIN badges b ON pb.badge_id = b.badge_id
    WHERE pb.player_uid IN (${Prisma.join(limitedUids)})
      AND (pb.expiration IS NULL OR pb.expiration >= CURDATE())
    ORDER BY pb.earned_at DESC
  `;

  // Group badges by player_uid and format to match BadgeData interface
  const groupedBadges = batchBadges.reduce<Record<string, BadgeData[]>>(
    (acc, badge) => {
      const playerUid = String(badge.player_uid);
      if (!acc[playerUid]) {
        acc[playerUid] = [];
      }

      // Convert to BadgeData format expected by Badge component
      const earnedAt = badge.earned_at as Date | null;
      const expiration = badge.expiration as Date | null;

      acc[playerUid].push({
        id: String(badge.id),
        quote: (badge.quote as string) || "",
        criteria: (badge.criteria as string) || "",
        short_description: (badge.short_description as string) || "",
        long_description: (badge.long_description as string) || "",
        icon: (badge.icon as string) || "",
        rarity: Number(badge.rarity) || 0,
        earned_at: earnedAt ? earnedAt.toISOString() : "",
        expiration: expiration ? expiration.toISOString() : null,
        description: badge.description as string | null,
        tier: badge.tier != null ? String(badge.tier) : null,
      });

      return acc;
    },
    {}
  );

  return groupedBadges;
}

// Cached version - cache key includes sorted UIDs hash for consistency
export function getCachedBadgesBatch(playerUids: string[]) {
  // Create a stable cache key from sorted UIDs
  const sortedUids = [...playerUids].sort();
  const cacheKey = `badges-batch-${sortedUids.join(",")}`;

  return unstable_cache(() => fetchBadgesBatchInternal(playerUids), [cacheKey], {
    tags: ["badges-batch"],
    revalidate: 604800, // 7 days
  })();
}

// Combined function to fetch rankings with badges
export async function fetchRankingsWithBadges(
  leagueId: number,
  periodId: number,
  periodType: string,
  includeBadges: boolean = true
): Promise<RankingsData | { error: string }> {
  const rankingsResult = await getCachedPeriodRankings(
    leagueId,
    periodId,
    periodType
  );

  if ("error" in rankingsResult) {
    return rankingsResult;
  }

  if (!includeBadges || rankingsResult.rankings.length === 0) {
    return rankingsResult;
  }

  // Fetch badges for all players
  const playerUids = rankingsResult.rankings.map((p) => p.uid);
  const badgesData = await getCachedBadgesBatch(playerUids);

  // Merge badges into rankings
  const rankingsWithBadges: PlayerRanking[] = rankingsResult.rankings.map(
    (player) => ({
      ...player,
      badges: badgesData[player.uid] || [],
    })
  );

  return {
    ...rankingsResult,
    rankings: rankingsWithBadges,
  };
}
