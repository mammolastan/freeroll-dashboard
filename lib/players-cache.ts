// lib/players-cache.ts
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDisplayName } from "@/lib/playerUtils";

export interface Player {
  uid: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  created: Date;
  modified: Date;
}

// Extended interface with computed display name for backwards compatibility
export interface PlayerWithDisplayName extends Player {
  name: string;
}

// Cached function that fetches all players (revalidates every 24 hours)
export const getCachedPlayers = unstable_cache(
  async (): Promise<PlayerWithDisplayName[]> => {
    console.log("Fetching fresh players data from database...");

    const players = await prisma.players_v2.findMany({
      orderBy: [
        { first_name: "asc" },
        { last_name: "asc" },
      ],
    });

    // Add computed display name for backwards compatibility
    const playersWithDisplayName = players.map(player => ({
      ...player,
      name: getDisplayName(player),
    }));

    console.log(`Loaded ${players.length} players into cache`);
    return playersWithDisplayName;
  },
  ["all-players"], // Cache key
  {
    revalidate: 24 * 60 * 60, // 24 hours in seconds
    tags: ["players"], // For manual invalidation
  }
);

// Helper function to format player names
export function formatPlayerName(
  player: PlayerWithDisplayName | undefined,
  format: "name" | "nickname" | "both" = "name",
  fallback: string = "Unknown Player"
): string {
  if (!player) return fallback;

  const { name, nickname } = player;

  switch (format) {
    case "name":
      return name;

    case "nickname":
      return nickname || name;

    case "both":
      return nickname ? `${name} (${nickname})` : name;

    default:
      return nickname ? nickname : name;
  }
}

// Server action to force refresh the cache (when you add new players)
export async function revalidatePlayersCache() {
  const { revalidateTag } = await import("next/cache");
  revalidateTag("players");
  console.log("🔄 Players cache invalidated - will refresh on next request");
}
