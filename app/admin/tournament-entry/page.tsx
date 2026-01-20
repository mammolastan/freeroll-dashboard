// app/admin/tournament-entry/page.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useScreenRouter } from "./hooks/useScreenRouter";
import { FullAdminScreen } from "./screens/Screen1_FullAdmin/FullAdminScreen";
import { GameTimerScreen } from "./screens/Screen2_GameTimer/GameTimerScreen";
import { PlayerCheckInScreen } from "./screens/Screen3_PlayerCheckIn/PlayerCheckInScreen";
import { PlayerControlScreen } from "./screens/Screen4_PlayerControl/PlayerControlScreen";
import { TDMessagesScreen } from "./screens/Screen5_TDMessages/TDMessagesScreen";
import { socket } from "@/lib/socketClient";

interface TournamentDraft {
  id: number;
  tournament_date: string;
  tournament_time?: string;
  director_name: string;
  venue: string;
  start_points: number;
  status: "in_progress" | "finalized" | "integrated";
  created_at: string;
  updated_at: string;
  player_count: number;
  blind_schedule?: string;
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

export default function TournamentEntryPage() {
  const { currentScreen, setCurrentScreen } = useScreenRouter(1);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // View state - determines whether to show tournament list or entry view
  const [currentView, setCurrentView] = useState<"welcome" | "entry">(
    "welcome",
  );

  // Shared state for all screens
  const [currentDraft, setCurrentDraft] = useState<TournamentDraft | null>(
    null,
  );
  const [players, setPlayers] = useState<Player[]>([]);
  const [dataVersion, setDataVersion] = useState(0);

  // Audio state - persists across screen changes
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [oneMinuteAudio] = useState(() =>
    typeof window !== "undefined"
      ? new Audio("/audio/OneMinuteRemaining-RedAlert.mp3")
      : null,
  );
  const [levelChangeAudio] = useState(() =>
    typeof window !== "undefined"
      ? new Audio("/audio/homepod_timer.mp3")
      : null,
  );

  // Enable audio on first user interaction (required for mobile browsers)
  const enableAudio = useCallback(() => {
    if (!audioEnabled && oneMinuteAudio && levelChangeAudio) {
      oneMinuteAudio.volume = 0.7;
      levelChangeAudio.volume = 0.7;

      // Preload audio files
      oneMinuteAudio.load();
      levelChangeAudio.load();

      setAudioEnabled(true);
      console.log("Audio enabled - will persist across screen changes");
    }
  }, [audioEnabled, oneMinuteAudio, levelChangeAudio]);

  // Load tournament and player data (only when authenticated)
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // Load tournaments to find the active one
      const tournamentsResponse = await fetch(
        "/api/tournament-drafts?limit=20",
      );
      if (tournamentsResponse.ok) {
        const tournaments: TournamentDraft[] = await tournamentsResponse.json();

        // Only auto-select if no tournament is currently selected
        if (!currentDraft) {
          // Find the most recent in_progress tournament
          const activeTournament = tournaments.find(
            (t) => t.status === "in_progress",
          );

          if (activeTournament) {
            setCurrentDraft(activeTournament);

            // Load players for this tournament
            const playersResponse = await fetch(
              `/api/tournament-drafts/${activeTournament.id}/players`,
            );
            if (playersResponse.ok) {
              const playersData: Player[] = await playersResponse.json();
              setPlayers(playersData);
            }
          } else {
            setCurrentDraft(null);
            setPlayers([]);
          }
        } else {
          // If a tournament is already selected, just reload its players
          const playersResponse = await fetch(
            `/api/tournament-drafts/${currentDraft.id}/players`,
          );
          if (playersResponse.ok) {
            const playersData: Player[] = await playersResponse.json();
            setPlayers(playersData);
          }
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, [isAuthenticated, currentDraft]);

  // Load data when authenticated or when data version changes
  useEffect(() => {
    loadData();
  }, [loadData, dataVersion]);

  // Socket.IO real-time updates for admin screens
  useEffect(() => {
    if (!currentDraft || !isAuthenticated) return;

    console.log("Admin: Setting up Socket.IO for tournament:", currentDraft.id);

    // Join the tournament room
    socket.emit("joinRoom", currentDraft.id.toString());

    // Listen for player updates
    const handlePlayersUpdated = (eventOrPlayers: unknown) => {
      console.log("Admin: Raw socket data:", eventOrPlayers);

      // STEP 1: Extract players array (handle multiple formats)
      let rawPlayers: unknown[];
      if (Array.isArray(eventOrPlayers)) {
        rawPlayers = eventOrPlayers;
      } else if (
        typeof eventOrPlayers === "object" &&
        eventOrPlayers !== null &&
        "data" in eventOrPlayers &&
        typeof eventOrPlayers.data === "object" &&
        eventOrPlayers.data !== null &&
        "players" in eventOrPlayers.data &&
        Array.isArray(eventOrPlayers.data.players)
      ) {
        rawPlayers = eventOrPlayers.data.players;
      } else {
        console.error("Unknown socket format:", eventOrPlayers);
        return;
      }

      // STEP 2: Normalize property names (socket format → admin format)
      const normalizedPlayers: Player[] = rawPlayers.map((p) => {
        // Type guard: ensure p is an object
        if (typeof p !== "object" || p === null) {
          return {
            id: 0,
            player_name: "",
            player_uid: null,
            player_nickname: null,
            is_new_player: false,
            hitman_name: null,
            ko_position: null,
            placement: null,
          };
        }

        const player = p as Record<string, unknown>;
        return {
          id: Number(player.id) || 0,
          player_name: String(player.name || player.player_name || ""),
          player_uid: player.uid
            ? String(player.uid)
            : player.player_uid
              ? String(player.player_uid)
              : null,
          player_nickname: player.nickname
            ? String(player.nickname)
            : player.player_nickname
              ? String(player.player_nickname)
              : null,
          is_new_player: Boolean(player.is_new_player),
          hitman_name: player.hitman_name ? String(player.hitman_name) : null,
          ko_position: player.ko_position
            ? Number(player.ko_position)
            : player.elimination_position
              ? Number(player.elimination_position)
              : null,
          placement: player.placement ? Number(player.placement) : null,
          added_by:
            player.added_by === "admin" || player.added_by === "self_checkin"
              ? player.added_by
              : undefined,
          checked_in_at: player.checked_in_at
            ? String(player.checked_in_at)
            : undefined,
        };
      });

      console.log("Admin: Normalized players:", normalizedPlayers);
      setPlayers([...normalizedPlayers]);
    };

    socket.on("players:updated", handlePlayersUpdated);
    socket.on("updatePlayers", handlePlayersUpdated);

    // Cleanup when component unmounts or tournament changes
    return () => {
      console.log(
        "Admin: Cleaning up Socket.IO for tournament:",
        currentDraft.id,
      );
      socket.off("players:updated", handlePlayersUpdated);
      socket.off("updatePlayers", handlePlayersUpdated);
    };
  }, [currentDraft, isAuthenticated]);

  // Callback for screens to trigger data reload
  const handleDataChange = useCallback(() => {
    setDataVersion((prev) => prev + 1);
  }, []);

  // Callback for Screen1 to update current draft selection
  const handleDraftChange = useCallback((draft: TournamentDraft | null) => {
    setCurrentDraft(draft);
    if (draft) {
      // When a draft is selected, switch to entry view
      setCurrentView("entry");
      // Reload players for this draft
      fetch(`/api/tournament-drafts/${draft.id}/players`)
        .then((res) => res.json())
        .then((data) => setPlayers(data))
        .catch((err) => console.error("Error loading players:", err));
    } else {
      // When draft is cleared, go back to welcome view
      setCurrentView("welcome");
      setPlayers([]);
    }
  }, []);

  return (
    <>
      {currentScreen === 1 && (
        <FullAdminScreen
          isAuthenticated={isAuthenticated}
          setIsAuthenticated={setIsAuthenticated}
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentDraft={currentDraft}
          players={players}
          onDraftChange={handleDraftChange}
          onDataChange={handleDataChange}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      )}

      {currentScreen === 2 && (
        <GameTimerScreen
          currentDraft={currentDraft}
          players={players}
          audioEnabled={audioEnabled}
          oneMinuteAudio={oneMinuteAudio}
          levelChangeAudio={levelChangeAudio}
          enableAudio={enableAudio}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      )}

      {currentScreen === 3 && (
        <PlayerCheckInScreen
          currentDraft={currentDraft}
          players={players}
          onDataChange={handleDataChange}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      )}

      {currentScreen === 4 && (
        <PlayerControlScreen
          currentDraft={currentDraft}
          players={players}
          onDataChange={handleDataChange}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      )}

      {currentScreen === 5 && (
        <TDMessagesScreen
          currentDraft={currentDraft}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      )}
    </>
  );
}
