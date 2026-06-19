import { useState, useRef, useCallback, useMemo } from "react";
import React from "react";

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

interface UseHitmanManagerOptions {
  players: Player[];
  displayPlayers: Player[];
  updatePlayer: (playerId: number, field: string, value: string | number | null) => Promise<void>;
  temporarilyDisableAutoRefresh: () => void;
}

interface UseHitmanManagerReturn {
  // State
  hitmanSearchValues: { [key: number]: string };
  hitmanDropdownVisible: { [key: number]: boolean };
  hitmanHighlightedIndex: Record<number, number>;
  // Functions
  getHitmanCandidates: (currentPlayerId: number, searchTerm: string) => Player[];
  selectHitman: (playerId: number, hitmanName: string) => void;
  clearPlayerKnockout: (playerId: number) => Promise<void>;
  handleCrosshairClick: (playerId: number) => void;
  handleHitmanSearchChange: (playerId: number, value: string) => void;
  handleHitmanFocus: (playerId: number) => void;
  handleHitmanBlur: (playerId: number) => void;
  handleHitmanKeyDown: (playerId: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  // For clearing state on undo
  clearHitmanSearchValues: () => void;
}

/**
 * Hook to manage hitman selection, knockout tracking, and related UI state.
 */
export function useHitmanManager({
  players,
  displayPlayers,
  updatePlayer,
  temporarilyDisableAutoRefresh,
}: UseHitmanManagerOptions): UseHitmanManagerReturn {
  const [hitmanSearchValues, setHitmanSearchValues] = useState<{ [key: number]: string }>({});
  const [hitmanDropdownVisible, setHitmanDropdownVisible] = useState<{ [key: number]: boolean }>({});
  const [hitmanHighlightedIndex, setHitmanHighlightedIndex] = useState<Record<number, number>>({});
  // Track when knockout was initiated via crosshair click (to default to "unknown" on blur)
  const [knockoutInitiated, setKnockoutInitiated] = useState<{ [key: number]: boolean }>({});

  // Ref to track when a hitman was selected via dropdown (to skip blur processing)
  const hitmanSelectedRef = useRef<{ [key: number]: boolean }>({});

  // Filter players for hitman selection - returns active (not knocked out) players
  const getHitmanCandidates = useCallback(
    (currentPlayerId: number, searchTerm: string): Player[] => {
      // Get all active players (not knocked out), excluding the current player
      // Use displayPlayers for optimistic updates (so newly knocked out players are excluded immediately)
      let candidates = displayPlayers
        .filter((p) => p.id !== currentPlayerId) // Exclude the current player
        .filter((p) => !p.knockedout_at); // Only active players (not knocked out)

      // If there's a search term, filter by name/nickname match
      if (searchTerm && searchTerm.length > 0) {
        const lowerSearch = searchTerm.toLowerCase();
        candidates = candidates.filter(
          (p) =>
            (p.player_name && p.player_name.toLowerCase().includes(lowerSearch)) ||
            (p.player_nickname && p.player_nickname.toLowerCase().includes(lowerSearch))
        );
      }

      // Sort by nickname (if available) or player_name
      candidates.sort((a, b) => {
        const nameA = (a.player_nickname || a.player_name || "").toLowerCase();
        const nameB = (b.player_nickname || b.player_name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

      return candidates.slice(0, 15); // Limit to 15 results
    },
    [displayPlayers]
  );

  // Handle hitman selection
  const selectHitman = useCallback(
    (playerId: number, hitmanName: string) => {
      // Mark that a selection was made (to skip blur processing)
      hitmanSelectedRef.current[playerId] = true;

      const finalHitmanName = hitmanName || "unknown";
      updatePlayer(playerId, "hitman_name", finalHitmanName);
      setHitmanSearchValues((prev) => ({ ...prev, [playerId]: finalHitmanName }));
      setHitmanDropdownVisible((prev) => ({ ...prev, [playerId]: false }));
      setKnockoutInitiated((prev) => ({ ...prev, [playerId]: false }));
    },
    [updatePlayer]
  );

  // Clear player knockout data
  const clearPlayerKnockout = useCallback(
    async (playerId: number) => {
      try {
        const player = players.find((p) => p.id === playerId);
        if (!player) {
          console.error("Player not found:", playerId);
          return;
        }

        // Disable auto-refresh temporarily
        temporarilyDisableAutoRefresh();

        // Clear ALL related UI state for this player IMMEDIATELY
        setHitmanSearchValues((prev) => ({ ...prev, [playerId]: "" }));
        setHitmanDropdownVisible((prev) => ({ ...prev, [playerId]: false }));
        setHitmanHighlightedIndex((prev) => ({ ...prev, [playerId]: -1 }));
        setKnockoutInitiated((prev) => ({ ...prev, [playerId]: false }));

        // Clear knockout - this saves immediately (no debounce) and clears both ko_position and hitman_name
        await updatePlayer(playerId, "ko_position", null);
      } catch (error) {
        console.error("Error clearing player knockout data:", error);
        alert(
          `Error clearing knockout data: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    [players, updatePlayer, temporarilyDisableAutoRefresh]
  );

  // Handle crosshair click - toggle knockout state
  const handleCrosshairClick = useCallback(
    (playerId: number) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return;

      // If player is already knocked out (has knockedout_at), clear knockout
      if (player.knockedout_at) {
        clearPlayerKnockout(playerId);
      } else {
        // If player is NOT knocked out, clear the search value and focus the hitman input
        // The dropdown will show all active players when focused
        setHitmanSearchValues((prev) => ({ ...prev, [playerId]: "" }));
        setHitmanDropdownVisible((prev) => ({ ...prev, [playerId]: true }));
        // Mark that knockout was initiated via crosshair (so blur defaults to "unknown")
        setKnockoutInitiated((prev) => ({ ...prev, [playerId]: true }));

        setTimeout(() => {
          const hitmanInput = document.getElementById(`hitman-input-${playerId}`) as HTMLInputElement;
          if (hitmanInput) {
            hitmanInput.focus();
          }
        }, 50);
      }
    },
    [players, clearPlayerKnockout]
  );

  // Handle hitman search input changes
  const handleHitmanSearchChange = useCallback(
    (playerId: number, value: string) => {
      setHitmanSearchValues((prev) => ({ ...prev, [playerId]: value }));
      setHitmanDropdownVisible((prev) => ({ ...prev, [playerId]: true })); // Always show dropdown while typing
      setHitmanHighlightedIndex((prev) => ({ ...prev, [playerId]: -1 }));

      // Only auto-update for exact player name matches during typing
      // Let the blur handler deal with "unknown" and other values
      const exactMatch = players.find(
        (p) => p.id !== playerId && p.player_name?.toLowerCase() === value.toLowerCase()
      );

      if (exactMatch) {
        updatePlayer(playerId, "hitman_name", exactMatch.player_name);
      }
    },
    [players, updatePlayer]
  );

  // Hitman input focus handler
  const handleHitmanFocus = useCallback(
    (playerId: number) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return;

      // Just open the dropdown with all active players - no auto-populating "unknown"
      setHitmanDropdownVisible((prev) => ({ ...prev, [playerId]: true }));
      setHitmanHighlightedIndex((prev) => ({ ...prev, [playerId]: -1 }));
    },
    [players]
  );

  // Hitman input blur handler
  const handleHitmanBlur = useCallback(
    (playerId: number) => {
      // Capture values immediately before the timeout
      const currentValue = hitmanSearchValues[playerId] ?? "";
      const wasKnockoutInitiated = knockoutInitiated[playerId] ?? false;

      // Clear the knockout initiated flag immediately
      setKnockoutInitiated((prev) => ({ ...prev, [playerId]: false }));

      // Delay the entire blur processing to allow dropdown clicks/taps to register first
      // This is especially important on mobile where tap events fire after blur
      setTimeout(() => {
        // Hide dropdown
        setHitmanDropdownVisible((prev) => ({ ...prev, [playerId]: false }));

        // Check if a hitman was selected via dropdown click/tap
        // If so, skip blur processing entirely - the selection already handled it
        if (hitmanSelectedRef.current[playerId]) {
          hitmanSelectedRef.current[playerId] = false; // Reset for next time
          return;
        }

        // Process the final value when user leaves the input
        // Check if typing a prefix of "unknown" (at least 2 chars to avoid false positives)
        if (currentValue.length >= 2 && "unknown".startsWith(currentValue.toLowerCase())) {
          // Treat as "unknown" - user is typing "un", "unk", "unknown", etc.
          updatePlayer(playerId, "hitman_name", "unknown");
          setHitmanSearchValues((prev) => ({ ...prev, [playerId]: "unknown" }));
        } else if (currentValue === "") {
          // If knockout was initiated via crosshair click, default to "unknown"
          // Otherwise, clear the hitman
          if (wasKnockoutInitiated) {
            updatePlayer(playerId, "hitman_name", "unknown");
            setHitmanSearchValues((prev) => ({ ...prev, [playerId]: "unknown" }));
          } else {
            updatePlayer(playerId, "hitman_name", null);
          }
        } else {
          // Check if it matches an exact player name
          const exactMatch = players.find(
            (p) => p.id !== playerId && p.player_name.toLowerCase() === currentValue.toLowerCase()
          );

          if (exactMatch) {
            updatePlayer(playerId, "hitman_name", exactMatch.player_name);
          } else {
            // Get the filtered candidates (same list shown in dropdown)
            const candidates = getHitmanCandidates(playerId, currentValue);
            if (candidates.length > 0) {
              // Select the first matching player (topmost in dropdown after "unknown")
              selectHitman(playerId, candidates[0].player_name);
            } else {
              // No matches found - default to "unknown" instead of arbitrary text
              updatePlayer(playerId, "hitman_name", "unknown");
              setHitmanSearchValues((prev) => ({ ...prev, [playerId]: "unknown" }));
            }
          }
        }
      }, 200); // Increased delay to ensure mobile taps register before blur processing
    },
    [hitmanSearchValues, knockoutInitiated, players, updatePlayer, getHitmanCandidates, selectHitman]
  );

  // Handle keyboard navigation in hitman dropdown
  const handleHitmanKeyDown = useCallback(
    (playerId: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const candidates = getHitmanCandidates(playerId, hitmanSearchValues[playerId] || "");

      // Create full options list with "unknown" always at the beginning (matching PlayerRow)
      const allOptions: Player[] = [
        {
          id: -1,
          player_name: "unknown",
          player_uid: null,
          is_new_player: false,
          hitman_name: null,
          ko_position: null,
          placement: null,
        },
        ...candidates,
      ];

      const currentHighlight = hitmanHighlightedIndex[playerId] ?? -1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (hitmanDropdownVisible[playerId] && allOptions.length > 0) {
            const nextIndex =
              currentHighlight < allOptions.length - 1 ? currentHighlight + 1 : 0;
            setHitmanHighlightedIndex((prev) => ({ ...prev, [playerId]: nextIndex }));
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (hitmanDropdownVisible[playerId] && allOptions.length > 0) {
            const prevIndex =
              currentHighlight > 0 ? currentHighlight - 1 : allOptions.length - 1;
            setHitmanHighlightedIndex((prev) => ({ ...prev, [playerId]: prevIndex }));
          }
          break;

        case "Enter":
          e.preventDefault();
          if (
            hitmanDropdownVisible[playerId] &&
            allOptions.length > 0 &&
            currentHighlight >= 0
          ) {
            // Select the highlighted option
            const selectedOption = allOptions[currentHighlight];
            selectHitman(playerId, selectedOption.player_name);
          } else {
            // No dropdown or no selection, just blur to trigger existing logic
            const hitmanInput = document.getElementById(`hitman-input-${playerId}`) as HTMLInputElement;
            if (hitmanInput) {
              hitmanInput.blur();
            }
          }
          break;

        case "Escape":
          e.preventDefault();
          setHitmanDropdownVisible((prev) => ({ ...prev, [playerId]: false }));
          setHitmanHighlightedIndex((prev) => ({ ...prev, [playerId]: -1 }));
          break;
      }
    },
    [getHitmanCandidates, hitmanSearchValues, hitmanHighlightedIndex, hitmanDropdownVisible, selectHitman]
  );

  // Clear all hitman state (for undo functionality and state reset)
  const clearHitmanSearchValues = useCallback(() => {
    setHitmanSearchValues({});
    setHitmanDropdownVisible({});
    setHitmanHighlightedIndex({});
    setKnockoutInitiated({});
  }, []);

  return {
    hitmanSearchValues,
    hitmanDropdownVisible,
    hitmanHighlightedIndex,
    getHitmanCandidates,
    selectHitman,
    clearPlayerKnockout,
    handleCrosshairClick,
    handleHitmanSearchChange,
    handleHitmanFocus,
    handleHitmanBlur,
    handleHitmanKeyDown,
    clearHitmanSearchValues,
  };
}
