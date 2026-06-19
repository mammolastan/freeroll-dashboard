import { useState, useEffect, useMemo, useCallback } from "react";

interface Player {
  id: number;
  player_name: string;
  player_uid: string | null;
  is_new_player: boolean;
  hitman_name: string | null;
  ko_position: number | null;
  placement: number | null;
  added_by?: "admin" | "self_checkin";
  checked_in_at?: string;
  player_nickname?: string | null;
  knockedout_at?: string | null;
}

interface UseOptimisticUpdatesOptions {
  players: Player[];
}

interface UseOptimisticUpdatesReturn {
  displayPlayers: Player[];
  optimisticUpdates: { [playerId: number]: Partial<Player> };
  setOptimisticUpdate: (playerId: number, update: Partial<Player>) => void;
  clearOptimisticUpdates: () => void;
}

/**
 * Hook to manage optimistic updates for players with immediate visual feedback.
 * Merges optimistic updates with real player data and auto-clears updates
 * when server data arrives.
 */
export function useOptimisticUpdates({
  players,
}: UseOptimisticUpdatesOptions): UseOptimisticUpdatesReturn {
  const [optimisticUpdates, setOptimisticUpdates] = useState<{
    [playerId: number]: Partial<Player>;
  }>({});

  // Merge players prop with optimistic updates for display
  const displayPlayers = useMemo(() => {
    return players.map((player) => {
      const optimistic = optimisticUpdates[player.id];
      if (optimistic) {
        return { ...player, ...optimistic };
      }
      return player;
    });
  }, [players, optimisticUpdates]);

  // Clear optimistic updates when real data arrives from server
  useEffect(() => {
    // When players prop changes, clear any optimistic updates that are now reflected in real data
    setOptimisticUpdates((prev) => {
      const newUpdates = { ...prev };
      let hasChanges = false;
      for (const playerId of Object.keys(newUpdates)) {
        const id = parseInt(playerId);
        const realPlayer = players.find((p) => p.id === id);
        const optimistic = newUpdates[id];
        if (realPlayer && optimistic) {
          // For knockouts: only clear if real data has BOTH hitman_name AND knockedout_at
          // This prevents flicker during intermediate states while parent reloads data
          if (
            optimistic.hitman_name &&
            realPlayer.hitman_name === optimistic.hitman_name &&
            realPlayer.knockedout_at // Must have knockedout_at set by server
          ) {
            delete newUpdates[id];
            hasChanges = true;
          }
          // For un-knockouts: only clear if real data has cleared both fields
          if (
            optimistic.hitman_name === null &&
            realPlayer.hitman_name === null &&
            !realPlayer.knockedout_at // Must have knockedout_at cleared by server
          ) {
            delete newUpdates[id];
            hasChanges = true;
          }
        }
      }
      return hasChanges ? newUpdates : prev;
    });
  }, [players]);

  const setOptimisticUpdate = useCallback(
    (playerId: number, update: Partial<Player>) => {
      setOptimisticUpdates((prev) => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          ...update,
        },
      }));
    },
    []
  );

  const clearOptimisticUpdates = useCallback(() => {
    setOptimisticUpdates({});
  }, []);

  return {
    displayPlayers,
    optimisticUpdates,
    setOptimisticUpdate,
    clearOptimisticUpdates,
  };
}
