// lib/players-cache.ts
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface Player {
  uid: string;
  name: string;
  nickname: string | null;
  created_at: Date;
  updated_at: Date;
}

// Cached function that fetches all players (revalidates every 24 hours)
export const getCachedPlayers = unstable_cache(
  async (): Promise<Player[]> => {
    console.log("🔄 Fetching fresh players data from database...");

    const players = await prisma.player.findMany({
      orderBy: {
        name: "asc",
      },
    });

    console.log(`✅ Loaded ${players.length} players into cache`);
    return players;
  },
  ["all-players"], // Cache key
  {
    revalidate: 24 * 60 * 60, // 24 hours in seconds
    tags: ["players"], // For manual invalidation
  }
);

// Helper function to format player names
export function formatPlayerName(
  player: Player | undefined,
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
