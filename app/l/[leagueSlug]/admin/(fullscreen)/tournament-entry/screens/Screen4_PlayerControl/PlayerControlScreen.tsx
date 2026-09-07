// app/admin/tournament-entry/screens/Screen4_PlayerControl/PlayerControlScreen.tsx

"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Target, Users, Trophy, X, History } from "lucide-react";
import { ScreenTabs } from "../../components/ScreenTabs";
import { ScreenNumber } from "../../hooks/useScreenRouter";
import { useTDActionHistory } from "@/hooks/useTDActionHistory";
import { ActionHistoryDrawer } from "@/components/td/ActionHistoryDrawer";

interface TournamentDraft {
  id: number;
  tournament_date: string;
  director_name: string;
  title?: string | null;
  venue: string | null;
  venue_id: number | null;
  start_points: number;
  status: "in_progress" | "finalized" | "integrated";
  created_at: string;
  updated_at: string;
  player_count: number;
  blind_schedule?: string;
  game_uid?: string | null;
}

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
}

interface PlayerControlScreenProps {
  currentDraft: TournamentDraft | null;
  players: Player[];
  onDataChange: () => void;
  currentScreen: ScreenNumber;
  onScreenChange: (screen: ScreenNumber) => void;
}

// Helper function to calculate dynamic placement based on ko_position
function calculatePlacement(
  player: Player,
  totalPlayers: number,
): number | null {
  if (player.ko_position === null) return null;
  return totalPlayers - player.ko_position + 1;
}

export function PlayerControlScreen({
  currentDraft,
  players,
  onDataChange,
  currentScreen,
  onScreenChange,
}: PlayerControlScreenProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedHitman, setSelectedHitman] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [hitmanSearchText, setHitmanSearchText] = useState("");
  const [highlightedHitmanIndex, setHighlightedHitmanIndex] =
    useState<number>(-1);
  const filterInputRef = useRef<HTMLTextAreaElement>(null);
  const hitmanInputRef = useRef<HTMLTextAreaElement>(null);

  // Action History state
  const [showActionHistory, setShowActionHistory] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning";
  } | null>(null);

  // Derive game_uid: use actual game_uid if set, otherwise use draft-{id} pattern
  const actionLogGameUid = currentDraft?.game_uid || (currentDraft ? `draft-${currentDraft.id}` : null);
  const {
    actions: actionHistory,
    canUndo,
    triggerUndo,
    isUndoing,
  } = useTDActionHistory(actionLogGameUid, {
    onUndoSuccess: (description) => {
      setToast({ message: description, type: "success" });
      onDataChange(); // Refresh player data after undo
      setTimeout(() => setToast(null), 3000);
    },
    onUndoError: (reason) => {
      setToast({ message: `Undo failed: ${reason}`, type: "warning" });
      setTimeout(() => setToast(null), 3000);
    },
  });

  // Players are knocked out when they have a ko_position (not null)
  // Memoize to prevent useEffect from resetting hitmanSearchText on every keystroke
  const allRemainingPlayers = useMemo(
    () => players.filter((p) => p.ko_position === null),
    [players]
  );

  // Filter remaining players based on filter text
  const remainingPlayers = allRemainingPlayers.filter((p) => {
    if (!filterText.trim()) return true;
    const searchText = filterText.toLowerCase();
    return (
      p.player_name.toLowerCase().includes(searchText) ||
      (p.player_nickname &&
        p.player_nickname.toLowerCase().includes(searchText))
    );
  });

  // Filter hitman options based on search text (searches both name and nickname)
  const filteredHitmanOptions = allRemainingPlayers
    .filter((p) => selectedPlayer && p.id !== selectedPlayer.id)
    .filter((p) => {
      if (!hitmanSearchText.trim()) return true;
      const searchText = hitmanSearchText.toLowerCase();
      return (
        p.player_name.toLowerCase().includes(searchText) ||
        (p.player_nickname && p.player_nickname.toLowerCase().includes(searchText))
      );
    });

  const knockedOutPlayers = players
    .filter((p) => p.ko_position !== null)
    .sort((a, b) => (b.ko_position || 0) - (a.ko_position || 0));

  const handleKnockout = useCallback(
    async (player: Player, hitmanName: string) => {
      if (!currentDraft || isSubmitting) return;

      setIsSubmitting(true);
      try {
        // Calculate next knockout position
        const maxKoPosition = Math.max(
          0,
          ...players.map((p) => p.ko_position || 0),
        );
        const nextKoPosition = maxKoPosition + 1;

        const response = await fetch(
          `/api/tournament-drafts/${currentDraft.id}/players/${player.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-Admin-Screen": "PlayerControl",
            },
            body: JSON.stringify({
              player_name: player.player_name,
              hitman_name: hitmanName || "unknown",
              ko_position: nextKoPosition,
            }),
          },
        );

        if (response.ok) {
          setSelectedPlayer(null);
          setSelectedHitman("");
          setFilterText("");
          onDataChange();
        } else {
          const errorData = await response.json();
          alert(errorData.error || "Failed to record knockout");
        }
      } catch (error) {
        console.error("Error recording knockout:", error);
        alert("Error recording knockout. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentDraft, isSubmitting, players, onDataChange],
  );

  // Reset highlighted index when filter changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filterText]);

  // Reset hitman search when modal opens/closes, auto-populate if only one hitman possible
  useEffect(() => {
    if (selectedPlayer) {
      const possibleHitmen = allRemainingPlayers.filter(p => p.id !== selectedPlayer.id);
      if (possibleHitmen.length === 1) {
        // Only one possible hitman - pre-populate
        setHitmanSearchText(possibleHitmen[0].player_name);
        setSelectedHitman(possibleHitmen[0].player_name);
      } else {
        setHitmanSearchText("");
        setSelectedHitman("");
      }
      setHighlightedHitmanIndex(-1);
      hitmanInputRef.current?.focus();
    }
  }, [selectedPlayer, allRemainingPlayers]);

  // Keyboard navigation for player list and modal
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      // ESC to close modal or blur filter input
      if (event.key === "Escape") {
        if (selectedPlayer) {
          event.preventDefault();
          setSelectedPlayer(null);
          setSelectedHitman("");
          setHitmanSearchText("");
          setHighlightedHitmanIndex(-1);
          return;
        } else if (target === filterInputRef.current) {
          event.preventDefault();
          filterInputRef.current?.blur();
          return;
        }
      }

      // Global shortcut: Press 'x' to focus filter (only when not in an input and modal is closed)
      if ((event.key === "x" || event.key === "X") && !selectedPlayer) {
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          target.tagName !== "SELECT"
        ) {
          event.preventDefault();
          filterInputRef.current?.focus();
          return;
        }
      }

      // Arrow key navigation when filter input is focused
      if (target === filterInputRef.current) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < remainingPlayers.length - 1 ? prev + 1 : prev,
          );
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (event.key === "Enter" && highlightedIndex >= 0) {
          event.preventDefault();
          const player = remainingPlayers[highlightedIndex];
          if (player) {
            setSelectedPlayer(player);
            setHighlightedIndex(-1);
            // Focus hitman input after a short delay
            setTimeout(() => hitmanInputRef.current?.focus(), 100);
          }
        }
      }

      // Arrow key navigation and Enter when hitman input is focused
      if (target === hitmanInputRef.current && selectedPlayer) {
        if (event.key === "ArrowDown" && filteredHitmanOptions.length > 0) {
          event.preventDefault();
          setHighlightedHitmanIndex((prev) =>
            prev < filteredHitmanOptions.length - 1 ? prev + 1 : 0,
          );
        } else if (
          event.key === "ArrowUp" &&
          filteredHitmanOptions.length > 0
        ) {
          event.preventDefault();
          setHighlightedHitmanIndex((prev) =>
            prev > 0 ? prev - 1 : filteredHitmanOptions.length - 1,
          );
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (
            highlightedHitmanIndex >= 0 &&
            filteredHitmanOptions[highlightedHitmanIndex]
          ) {
            // Select highlighted hitman
            const hitman = filteredHitmanOptions[highlightedHitmanIndex];
            setSelectedHitman(hitman.player_name);
            setHitmanSearchText(hitman.player_name);
            setHighlightedHitmanIndex(-1);
            // Submit immediately
            handleKnockout(selectedPlayer, hitman.player_name);
          } else {
            // No selection or no filter - use "unknown"
            const hitmanName = hitmanSearchText.trim() || "unknown";
            handleKnockout(selectedPlayer, hitmanName);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [
    highlightedIndex,
    remainingPlayers,
    selectedPlayer,
    hitmanSearchText,
    highlightedHitmanIndex,
    filteredHitmanOptions,
    handleKnockout,
  ]);

  const handleUndoKnockout = async (player: Player) => {
    if (!currentDraft || isSubmitting) return;

    if (!confirm(`Undo knockout for ${player.player_name}?`)) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/tournament-drafts/${currentDraft.id}/players/${player.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Screen": "PlayerControl",
          },
          body: JSON.stringify({
            player_name: player.player_name,
            hitman_name: null,
            ko_position: null,
          }),
        },
      );

      if (response.ok) {
        onDataChange();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to undo knockout");
      }
    } catch (error) {
      console.error("Error undoing knockout:", error);
      alert("Error undoing knockout. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cyan-300 mb-4">
            No Active Tournament
          </h1>
          <p className="text-gray-400 text-lg">
            Please create or select a tournament on Screen 1 (Full Admin)
          </p>
          <div className="mt-8 text-sm text-gray-500">
            Press 1 to go to Full Admin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      {/* Screen Navigation Tabs */}
      <ScreenTabs
        currentScreen={currentScreen}
        onScreenChange={onScreenChange}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
          <div
            className={`p-4 rounded-lg shadow-lg border ${
              toast.type === "success"
                ? "bg-green-900/90 border-green-500"
                : "bg-yellow-900/90 border-yellow-500"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className={`text-sm font-medium ${
                toast.type === "success" ? "text-green-200" : "text-yellow-200"
              }`}>
                {toast.message}
              </p>
              <button
                onClick={() => setToast(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-cyan-300 mb-2 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
          Player Control
        </h1>
        <p className="text-xl text-gray-400">
          {currentDraft.title || currentDraft.venue || 'Tournament'}
        </p>
      </div>

      {/* Knockout Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/80 flex items-start lg:items-center justify-center z-50 p-2 lg:p-4 pt-2">
          <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 max-w-5xl w-full h-[calc(100vh-1rem)] lg:h-auto lg:max-h-[90vh]">
            {/* Main Modal */}
            <div className="bg-gray-900 border-2 border-cyan-500 rounded-xl p-4 lg:p-8 lg:flex-1 shrink-0 overflow-y-auto">
              <h2 className="text-2xl lg:text-3xl font-bold text-cyan-300 mb-4 lg:mb-6 text-center">
                Record Knockout
              </h2>

              <div className="mb-4 lg:mb-6 text-center">
                <div className="text-xl lg:text-2xl font-bold text-white mb-2">
                  {selectedPlayer.player_name}
                </div>
                <div className="text-base lg:text-lg text-gray-400">
                  Placement: #{allRemainingPlayers.length}
                </div>
              </div>

              <div className="mb-4 lg:mb-6">
                <label className="block text-gray-300 text-base lg:text-lg mb-2 lg:mb-3">
                  Select hitman from the list, or type a name:
                </label>
                <textarea
                  ref={hitmanInputRef}
                  rows={1}
                  value={hitmanSearchText}
                  onChange={(e) => {
                    setHitmanSearchText(e.target.value);
                    setHighlightedHitmanIndex(-1);
                  }}
                  placeholder="Type name or press Enter for 'unknown'..."
                  className="w-full px-4 py-3 text-lg lg:text-xl bg-gray-800 border-2 border-cyan-500/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500 resize-none overflow-hidden"
                />
                {hitmanSearchText.trim() && filteredHitmanOptions.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto bg-gray-800 border-2 border-cyan-500/50 rounded-lg">
                    {filteredHitmanOptions.map((p, index) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setHighlightedHitmanIndex(-1);
                          handleKnockout(selectedPlayer, p.player_name);
                        }}
                        className={`w-full px-4 py-3 text-left text-lg transition-all ${
                          highlightedHitmanIndex === index
                            ? "bg-cyan-500/30 text-cyan-300"
                            : "text-white hover:bg-gray-700"
                        }`}
                      >
                        {p.player_name}
                        {p.player_nickname && (
                          <span className="text-cyan-400 ml-2">({p.player_nickname})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleKnockout(selectedPlayer, hitmanSearchText.trim() || "unknown")}
                  disabled={isSubmitting}
                  className="flex-1 px-4 lg:px-6 py-3 text-lg lg:text-xl font-bold bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all disabled:opacity-50 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                >
                  <Target
                    className="inline mr-2"
                    size={24}
                  />
                  {hitmanSearchText.trim() ? `Knockout by "${hitmanSearchText.trim()}"` : "Knockout (Unknown)"}
                </button>
                <button
                  onClick={() => {
                    setSelectedPlayer(null);
                    setSelectedHitman("");
                  }}
                  disabled={isSubmitting}
                  className="px-4 lg:px-6 py-3 text-lg lg:text-xl font-bold bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all border-2 border-gray-600"
                >
                  <X
                    className="inline mr-2"
                    size={24}
                  />
                  Cancel
                </button>
              </div>
            </div>

            {/* Active Players List */}
            <div className="bg-gray-900 border-2 border-green-500 rounded-xl pl-2 pt-2 pb-2 pr-0 lg:p-3 flex flex-col flex-1 lg:flex-none min-h-0 lg:w-auto lg:max-w-md lg:self-start">
              <h3 className="text-base lg:text-lg font-bold text-green-400 mb-2 text-center flex items-center justify-center gap-2 pr-2 lg:pr-0">
                <Target size={18} />
                Select Hitman
              </h3>
              {/* Mobile: vertical scrolling list */}
              <div
                className="hitman-list flex-1 overflow-y-auto space-y-1 pr-2 lg:hidden"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#22c55e #1f2937'
                }}
              >
                <style>{`
                  .hitman-list::-webkit-scrollbar {
                    width: 6px;
                  }
                  .hitman-list::-webkit-scrollbar-track {
                    background: #1f2937;
                    border-radius: 3px;
                  }
                  .hitman-list::-webkit-scrollbar-thumb {
                    background: #22c55e;
                    border-radius: 3px;
                  }
                  .hitman-list::-webkit-scrollbar-thumb:hover {
                    background: #16a34a;
                  }
                `}</style>
                {allRemainingPlayers
                  .filter((p) => p.id !== selectedPlayer.id)
                  .sort((a, b) => a.player_name.localeCompare(b.player_name))
                  .map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleKnockout(selectedPlayer, player.player_name)}
                      disabled={isSubmitting}
                      className="w-full px-2 py-1.5 bg-gray-800/80 border border-green-500/50 rounded text-left hover:bg-green-500/20 hover:border-green-400 transition-all disabled:opacity-50"
                    >
                      <div className="text-sm font-semibold text-white leading-tight">
                        {player.player_name}
                      </div>
                      {player.player_nickname && (
                        <div className="text-xs text-cyan-400 leading-tight">
                          &quot;{player.player_nickname}&quot;
                        </div>
                      )}
                    </button>
                  ))}
                {allRemainingPlayers.filter((p) => p.id !== selectedPlayer.id).length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No other players remaining
                  </div>
                )}
              </div>
              {/* Desktop: wrapping grid that expands to fit all players */}
              <div className="hidden lg:flex flex-wrap gap-1.5 content-start">
                {allRemainingPlayers
                  .filter((p) => p.id !== selectedPlayer.id)
                  .sort((a, b) => a.player_name.localeCompare(b.player_name))
                  .map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleKnockout(selectedPlayer, player.player_name)}
                      disabled={isSubmitting}
                      className="px-2 py-1 bg-gray-800/80 border border-green-500/50 rounded text-left hover:bg-green-500/20 hover:border-green-400 transition-all disabled:opacity-50 shrink-0"
                    >
                      <div className="text-sm font-semibold text-white whitespace-nowrap">
                        {player.player_name}
                        {player.player_nickname && (
                          <span className="text-cyan-400 ml-1 text-xs">({player.player_nickname})</span>
                        )}
                      </div>
                    </button>
                  ))}
                {allRemainingPlayers.filter((p) => p.id !== selectedPlayer.id).length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm w-full">
                    No other players remaining
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split View: Remaining vs Knocked Out */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Remaining Players */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Users
              className="text-green-400"
              size={32}
            />
            <h2 className="text-3xl font-bold text-green-400">
              Remaining ({allRemainingPlayers.length})
            </h2>
          </div>

          {/* Filter Input */}
          <div className="mb-3">
            <textarea
              ref={filterInputRef}
              rows={1}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter players... (press 'x')"
              className="w-full px-3 py-2 text-sm bg-gray-800/60 border border-green-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 resize-none overflow-hidden"
            />
          </div>

          <div className="space-y-3">
            {remainingPlayers.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xl">
                {filterText.trim()
                  ? "No players match your filter"
                  : "No players remaining"}
              </div>
            ) : (
              remainingPlayers.map((player, index) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  disabled={isSubmitting}
                  className={`w-full p-6 border-2 rounded-xl transition-all text-left group ${
                    highlightedIndex === index
                      ? "bg-green-500/20 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                      : "bg-gray-800/80 border-green-500/50 hover:border-green-500 hover:bg-gray-700/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white group-hover:text-green-400 transition-colors">
                        {player.player_name}
                      </div>
                      {player.player_nickname && (
                        <div className="text-lg text-cyan-400 mt-1">
                          &quot;{player.player_nickname}&quot;
                        </div>
                      )}
                      {player.is_new_player ? (
                        <div className="text-sm text-yellow-400 mt-1">
                          New Player
                        </div>
                      ) : (
                        ""
                      )}
                    </div>
                    <div className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Target size={32} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Knocked Out Players */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Trophy
              className="text-red-400"
              size={32}
            />
            <h2 className="text-3xl font-bold text-red-400">
              Knocked Out ({knockedOutPlayers.length})
            </h2>
          </div>

          <div className="space-y-3">
            {knockedOutPlayers.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xl">
                No knockouts yet
              </div>
            ) : (
              knockedOutPlayers.map((player) => (
                <div
                  key={player.id}
                  className="p-6 bg-gray-800/60 border-2 border-red-500/30 rounded-xl"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-2xl font-bold text-red-400">
                          KO #{player.ko_position}
                        </div>
                        <div>
                          <div className="text-xl font-bold text-white">
                            {player.player_name}
                          </div>
                          {player.player_nickname && (
                            <div className="text-lg text-cyan-400">
                              &quot;{player.player_nickname}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                      {player.hitman_name && (
                        <div className="text-gray-400 ml-16">
                          <Target
                            size={16}
                            className="inline mr-1"
                          />
                          Knocked out by:{" "}
                          <span className="text-cyan-400 font-semibold">
                            {player.hitman_name}
                          </span>
                        </div>
                      )}
                      {calculatePlacement(player, players.length) !== null && (
                        <div className="text-gray-500 text-sm ml-16 mt-1">
                          Final Placement: #
                          {calculatePlacement(player, players.length)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUndoKnockout(player)}
                      disabled={isSubmitting}
                      className="px-3 py-1 text-sm bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded border border-yellow-500/50 transition-all"
                      title="Undo knockout"
                    >
                      Undo
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Floating Action History Button */}
      <button
        onClick={() => setShowActionHistory(true)}
        className="fixed bottom-0 right-0 z-40 flex flex-col items-center justify-center w-16 h-16 bg-gray-800 hover:bg-gray-700 text-white rounded-tl-xl shadow-lg transition-all border-t border-l border-cyan-500/50"
        title="View action history (Ctrl+Z to undo)"
      >
        <History className="h-5 w-5" />
        {actionHistory.filter(a => a.status === 'applied').length > 0 && (
          <span className="text-xs text-cyan-400 font-medium">
            {actionHistory.filter(a => a.status === 'applied').length}
          </span>
        )}
      </button>

      {/* Action History Drawer */}
      <ActionHistoryDrawer
        isOpen={showActionHistory}
        onClose={() => setShowActionHistory(false)}
        actions={actionHistory}
        canUndo={canUndo}
        onUndo={triggerUndo}
        isUndoing={isUndoing}
        gameName={currentDraft.title || currentDraft.venue || "Tournament"}
      />
    </div>
  );
}
