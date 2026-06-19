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

type SortColumn = "name" | "ko_position" | "insertion" | "checked_in_at";
type SortOrder = "asc" | "desc";

interface UseSortedPlayerListOptions {
  players: Player[];
  koPositionsMap: Map<number, number>;
}

interface UseSortedPlayerListReturn {
  sortBy: SortColumn;
  sortOrder: SortOrder;
  sortedPlayers: Player[];
  handleSort: (column: "name" | "ko_position" | "checked_in_at") => void;
  resetToDefaultSort: () => void;
}

/**
 * Hook to manage player list sorting with localStorage persistence.
 */
export function useSortedPlayerList({
  players,
  koPositionsMap,
}: UseSortedPlayerListOptions): UseSortedPlayerListReturn {
  const [sortBy, setSortBy] = useState<SortColumn>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminSortBy");
      if (
        saved &&
        ["name", "ko_position", "insertion", "checked_in_at"].includes(saved)
      ) {
        return saved as SortColumn;
      }
    }
    return "insertion";
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminSortOrder");
      if (saved && ["asc", "desc"].includes(saved)) {
        return saved as SortOrder;
      }
    }
    return "asc";
  });

  // Save sort preferences to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("adminSortBy", sortBy);
      localStorage.setItem("adminSortOrder", sortOrder);
    }
  }, [sortBy, sortOrder]);

  // Get filtered and sorted players
  const sortedPlayers = useMemo(() => {
    const filteredPlayers = [...players];

    return filteredPlayers.sort((a, b) => {
      if (sortBy === "name") {
        const nameA = (a.player_name || "").toLowerCase();
        const nameB = (b.player_name || "").toLowerCase();
        return sortOrder === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      if (sortBy === "ko_position") {
        const koA = koPositionsMap.get(a.id) ?? null;
        const koB = koPositionsMap.get(b.id) ?? null;

        if (koA === null && koB === null) return 0;
        if (koA === null) return sortOrder === "desc" ? -1 : 1;
        if (koB === null) return sortOrder === "desc" ? 1 : -1;

        return sortOrder === "asc" ? koA - koB : koB - koA;
      }

      if (sortBy === "checked_in_at") {
        if (!a.checked_in_at && !b.checked_in_at) return 0;
        if (!a.checked_in_at) return sortOrder === "asc" ? 1 : -1;
        if (!b.checked_in_at) return sortOrder === "asc" ? -1 : 1;
        const dateA = new Date(a.checked_in_at).getTime();
        const dateB = new Date(b.checked_in_at).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }

      if (sortBy === "insertion") {
        return sortOrder === "asc" ? a.id - b.id : b.id - a.id;
      }

      return 0;
    });
  }, [players, sortBy, sortOrder, koPositionsMap]);

  // Handle column header click for sorting
  const handleSort = useCallback(
    (column: "name" | "ko_position" | "checked_in_at") => {
      if (sortBy === column) {
        setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortOrder("asc");
      }
    },
    [sortBy]
  );

  const resetToDefaultSort = useCallback(() => {
    if (sortBy === "insertion") {
      // If already in insertion mode, toggle the order
      setSortOrder((order) => (order === "desc" ? "asc" : "desc"));
    } else {
      // If not in insertion mode, go to insertion mode with newest first
      setSortBy("insertion");
      setSortOrder("desc");
    }
  }, [sortBy]);

  return {
    sortBy,
    sortOrder,
    sortedPlayers,
    handleSort,
    resetToDefaultSort,
  };
}
