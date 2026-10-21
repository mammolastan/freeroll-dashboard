// Shared utility for calculating KO positions based on knockedout_at timestamps
// This ensures consistent KO position display across all admin screens

interface PlayerWithKnockout {
  id: number;
  knockedout_at?: string | Date | null;
}

/**
 * Calculate KO positions based on knockedout_at timestamp order.
 * Oldest knockedout_at = position 1, second oldest = position 2, etc.
 * Returns a Map of playerId -> ko_position
 */
export function calculateKoPositions<T extends PlayerWithKnockout>(
  players: T[]
): Map<number, number> {
  const knockedOutPlayers = players
    .filter((p) => p.knockedout_at)
    .sort((a, b) => {
      const timeA = new Date(a.knockedout_at!).getTime();
      const timeB = new Date(b.knockedout_at!).getTime();
      if (timeA !== timeB) return timeA - timeB;
      // Tie-breaker: use player id (lower id = earlier knockout)
      return a.id - b.id;
    });

  const positionMap = new Map<number, number>();
  knockedOutPlayers.forEach((player, index) => {
    positionMap.set(player.id, index + 1);
  });

  return positionMap;
}

/**
 * Get the KO position for a specific player based on knockedout_at order.
 * Returns null if the player is not knocked out.
 */
export function getKoPosition<T extends PlayerWithKnockout>(
  player: T,
  allPlayers: T[]
): number | null {
  if (!player.knockedout_at) return null;
  const positionMap = calculateKoPositions(allPlayers);
  return positionMap.get(player.id) ?? null;
}

/**
 * Get knocked out players sorted by KO position (latest knockout first for display).
 * Returns players with their calculated KO positions.
 */
export function getKnockedOutPlayersSorted<T extends PlayerWithKnockout>(
  players: T[]
): Array<T & { calculatedKoPosition: number }> {
  const positionMap = calculateKoPositions(players);

  return players
    .filter((p) => p.knockedout_at)
    .map((p) => ({
      ...p,
      calculatedKoPosition: positionMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.calculatedKoPosition - a.calculatedKoPosition);
}

/**
 * Calculate placement based on KO position and total players.
 * KO #1 (first out) = last place, highest KO = 2nd place (winner is not knocked out)
 */
export function calculatePlacement(
  koPosition: number | null,
  totalPlayers: number
): number | null {
  if (koPosition === null) return null;
  return totalPlayers - koPosition + 1;
}
