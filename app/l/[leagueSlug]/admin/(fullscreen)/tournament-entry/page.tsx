// app/admin/tournament-entry/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useScreenRouter } from "./hooks/useScreenRouter";
import { useSocketConnectionStatus } from "./hooks/useSocketConnectionStatus";
import { FullAdminScreen } from "./screens/Screen1_FullAdmin/FullAdminScreen";
import { GameTimerScreen } from "./screens/Screen2_GameTimer/GameTimerScreen";
import { PlayerCheckInScreen } from "./screens/Screen3_PlayerCheckIn/PlayerCheckInScreen";
import { PlayerControlScreen } from "./screens/Screen4_PlayerControl/PlayerControlScreen";
import { TDMessagesScreen } from "./screens/Screen5_TDMessages/TDMessagesScreen";
import { TableAssignmentScreen } from "./screens/Screen6_TableAssignment";
import { socket } from "@/lib/socketClient";
import { setGlobalAudioState } from "@/hooks/useTimerAudio";

// Pre-load audio files and prime the AudioContext on first user interaction
// This enables timer sounds without requiring a separate "Enable Sound" click
const AUDIO_FILES = [
  '/audio/OneMinuteRemaining-RedAlert.mp3',
  '/audio/homepod_timer.mp3',
];

let audioUnlockAttempted = false;

async function unlockGlobalAudio() {
  if (audioUnlockAttempted) return;
  audioUnlockAttempted = true;
  if (typeof window === 'undefined') return;

  try {
    const ctx = new AudioContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Pre-load audio files into buffers
    const buffers = new Map<string, AudioBuffer>();
    await Promise.all(
      AUDIO_FILES.map(async (url) => {
        try {
          const res = await fetch(url);
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          buffers.set(url, audioBuffer);
        } catch (err) {
          console.warn(`[AudioPreload] Failed to decode ${url}:`, err);
        }
      })
    );

    // Share with the useTimerAudio hook
    setGlobalAudioState(ctx, buffers, true);
    console.log('[AudioPreload] Audio unlocked and buffers pre-loaded');
  } catch (err) {
    console.warn('[AudioPreload] Failed to unlock audio:', err);
  }
}

interface TournamentDraft {
  id: number;
  tournament_date: string;
  tournament_time?: string;
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
  custom_blind_levels?: string | null;
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
  knockedout_at?: string | null;
  t_assign?: number;
  photo_url?: string | null;
}

export default function TournamentEntryPage() {
  const { currentScreen, setCurrentScreen } = useScreenRouter(1);
  const { connectionStatus, reconnectAttempt, manualReconnect } = useSocketConnectionStatus();
  const searchParams = useSearchParams();
  const router = useRouter();
  const audioUnlockedRef = useRef(false);

  // Read the panel parameter for deep-linking (e.g., ?panel=hitman-claims)
  const initialOpenPanel = searchParams.get("panel");

  // Unlock audio on first user interaction anywhere in the admin area
  // This enables timer sounds without requiring a separate "Enable Sound" click
  useEffect(() => {
    if (audioUnlockedRef.current) return;

    const handleFirstInteraction = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      unlockGlobalAudio();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Authentication is now handled by middleware - if we reach this page, user is an admin

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

  // Load tournament and player data
  const loadData = useCallback(async () => {
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
  }, [currentDraft]);

  // Load data when authenticated or when data version changes
  useEffect(() => {
    loadData();
  }, [loadData, dataVersion]);

  // Socket.IO real-time updates for admin screens
  useEffect(() => {
    if (!currentDraft) return;

    const roomId = currentDraft.id.toString();

    // Join the tournament room
    socket.emit("joinRoom", roomId);

    // Re-join room on reconnect (handles mobile backgrounding, network drops, etc.)
    const handleReconnect = () => {
      console.log("[Socket] Reconnected - rejoining room:", roomId);
      socket.emit("joinRoom", roomId);
    };
    socket.on("connect", handleReconnect);

    // Listen for player updates
    const handlePlayersUpdated = (eventOrPlayers: unknown) => {
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
            knockedout_at: null,
            t_assign: 0,
            photo_url: null,
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
          knockedout_at: player.knockedout_at
            ? String(player.knockedout_at)
            : null,
          t_assign: player.t_assign ? Number(player.t_assign) : 0,
          photo_url: player.photo_url ? String(player.photo_url) : null,
        };
      });

      setPlayers([...normalizedPlayers]);
    };

    socket.on("players:updated", handlePlayersUpdated);
    socket.on("updatePlayers", handlePlayersUpdated);

    // Cleanup when component unmounts or tournament changes
    return () => {
      socket.off("connect", handleReconnect);
      socket.off("players:updated", handlePlayersUpdated);
      socket.off("updatePlayers", handlePlayersUpdated);
    };
  }, [currentDraft]);

  // Polling fallback: refresh player data every 30 seconds
  // This ensures data stays in sync even if socket events are missed
  useEffect(() => {
    if (!currentDraft) return;

    const pollInterval = setInterval(async () => {
      try {
        const playersResponse = await fetch(
          `/api/tournament-drafts/${currentDraft.id}/players`,
        );
        if (playersResponse.ok) {
          const playersData: Player[] = await playersResponse.json();
          setPlayers(playersData);
        }
      } catch (error) {
        console.error("Polling refresh failed:", error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(pollInterval);
  }, [currentDraft]);

  // Refresh data when switching screens
  // This catches any pending non-KO updates that were saved via sendBeacon on unmount
  // KOs save immediately, so socket handles those in real-time
  useEffect(() => {
    if (!currentDraft) return;

    // Single refresh after a short delay to catch any sendBeacon updates
    const timeoutId = setTimeout(async () => {
      try {
        const playersResponse = await fetch(
          `/api/tournament-drafts/${currentDraft.id}/players`,
        );
        if (playersResponse.ok) {
          const playersData: Player[] = await playersResponse.json();
          setPlayers(playersData);
        }
      } catch (error) {
        console.error("Screen change refresh failed:", error);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentScreen, currentDraft]);

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
      {/* Disconnected overlay */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && (
        <div
          className="fixed inset-0 bg-yellow-500/20 z-40 pointer-events-none"
          style={{ backdropFilter: 'saturate(0.8)' }}
        />
      )}

      {/* Connection status indicator */}
      {connectionStatus === 'connected' && (
        <div className="fixed bottom-4 left-4 z-50 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(34,197,94,0.5)] border border-green-400/50 animate-pulse">
          Live
        </div>
      )}
      {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && (
        <button
          onClick={manualReconnect}
          className="fixed bottom-4 left-4 z-50 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(234,179,8,0.5)] border border-yellow-400/50 animate-pulse hover:from-yellow-400 hover:to-orange-400 cursor-pointer"
        >
          {reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt})... Tap to retry` : 'Reconnecting... Tap to retry'}
        </button>
      )}
      {connectionStatus === 'connecting' && (
        <div className="fixed bottom-4 left-4 z-50 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-blue-400/50 animate-pulse">
          Connecting...
        </div>
      )}

      {currentScreen === 1 && (
        <FullAdminScreen
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentDraft={currentDraft}
          players={players}
          onDraftChange={handleDraftChange}
          onDataChange={handleDataChange}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
          initialOpenPanel={initialOpenPanel}
          onPanelOpened={() => {
            // Clear the panel parameter from URL after opening to prevent re-open on refresh
            const url = new URL(window.location.href);
            url.searchParams.delete("panel");
            router.replace(url.pathname + url.search, { scroll: false });
          }}
        />
      )}

      {currentScreen === 2 && (
        <GameTimerScreen
          currentDraft={currentDraft}
          players={players}
          onDataChange={handleDataChange}
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

      {currentScreen === 6 && (
        <TableAssignmentScreen
          currentDraft={currentDraft}
          players={players}
          onDataChange={handleDataChange}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      )}
    </>
  );
}
