// lib/rankings-cache.ts
// Cache invalidation for rankings and games pages
// Data is cached indefinitely and invalidated when tournaments are finalized or edited

/**
 * Invalidates rankings and games cache for a league.
 * Both are invalidated together since they share the same data triggers.
 *
 * Always invalidates:
 * - Games cache (`games-{leagueId}`)
 * - Leaderboard/cross-period cache (`rankings-all-{leagueId}`)
 *
 * @param leagueId - The league ID
 * @param periodTypes - Optional array of period types to also invalidate (e.g., ["monthly", "quarterly"])
 */
export async function revalidateRankingsCache(
  leagueId: number,
  periodTypes?: string[]
): Promise<void> {
  const { revalidateTag } = await import("next/cache");

  // Always invalidate games cache (not period-specific)
  const gamesTag = `games-${leagueId}`;
  revalidateTag(gamesTag);
  console.log(`🔄 Games cache invalidated: ${gamesTag}`);

  // Always invalidate the "all" tag (used by leaderboard and other cross-period views)
  const allTag = `rankings-all-${leagueId}`;
  revalidateTag(allTag);
  console.log(`🔄 Rankings cache invalidated (all): ${allTag}`);

  // Also invalidate specific period types if provided
  if (periodTypes && periodTypes.length > 0) {
    const uniqueTypes = Array.from(new Set(periodTypes));
    for (const periodType of uniqueTypes) {
      const tag = `rankings-${periodType}-${leagueId}`;
      revalidateTag(tag);
      console.log(`🔄 Rankings cache invalidated: ${tag}`);
    }
  }
}

/**
 * Generates cache tags for a rankings query.
 * Returns both a specific tag and an "all" tag so that either granular
 * or full invalidation will clear this cache entry.
 *
 * @param leagueId - The league ID
 * @param periodType - The period type (e.g., "monthly", "quarterly")
 * @returns Array of cache tags
 */
export function getRankingsCacheTags(
  leagueId: number,
  periodType: string
): string[] {
  return [
    `rankings-${periodType}-${leagueId}`,  // Granular tag for specific period type
    `rankings-all-${leagueId}`,             // Catch-all tag for full invalidation
  ];
}

/**
 * Generates cache tags for a games query.
 *
 * @param leagueId - The league ID
 * @returns Array of cache tags
 */
export function getGamesCacheTags(leagueId: number): string[] {
  return [`games-${leagueId}`];
}
