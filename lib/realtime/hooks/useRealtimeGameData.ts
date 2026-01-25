// lib/realtime/hooks/useRealtimeGameData.ts

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { socket } from '@/lib/socketClient';
import { Tournament, Player, GameViewData } from '../types';

export function useRealtimeGameData(tournamentId: string | number) {
  const [gameData, setGameData] = useState<GameViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const tournamentIdNum = typeof tournamentId === 'string' ? parseInt(tournamentId) : tournamentId;

  // Fetch game data via HTTP API
  const fetchGameData = useCallback(async () => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) return null;

    try {
      const response = await fetch(`/api/tournaments/${tournamentIdNum}/gameview`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch game data');
      }
      return await response.json();
    } catch (err) {
      console.error('Error fetching game data:', err);
      throw err;
    }
  }, [tournamentIdNum]);

  // Initial HTTP fetch for game data
  useEffect(() => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) {
      setLoading(false);
      return;
    }

    // Prevent double-fetch in React strict mode
    if (hasFetched.current) return;
    hasFetched.current = true;

    const loadInitialData = async () => {
      try {
        const data = await fetchGameData();
        if (data) {
          setGameData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [tournamentIdNum, fetchGameData]);

  // Refresh data when page becomes visible again (handles missed WebSocket events)
  useEffect(() => {
    if (!tournamentIdNum || isNaN(tournamentIdNum)) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[GameData] Page became visible, refreshing data...');
        try {
          const data = await fetchGameData();
          if (data) {
            setGameData(data);
          }
        } catch (err) {
          console.error('[GameData] Error refreshing on visibility change:', err);
          // Don't set error state to avoid disrupting the UI for background refresh failures
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tournamentIdNum, fetchGameData]);

  // Socket.IO real-time updates
  useEffect(() => {
    if (!tournamentIdNum) return;

    // Connect and join room
    socket.on("connect", () => {
      console.log("Connected to server with ID:", socket.id);
      socket.emit("joinRoom", tournamentIdNum.toString());
    });

    // If already connected, join room immediately
    if (socket.connected) {
      console.log("Already connected, joining room immediately");
      socket.emit("joinRoom", tournamentIdNum.toString());
    }

    // Handle initial data load (backwards compatibility)
    socket.on("updatePlayers", (players: Player[]) => {
      console.log("Received updatePlayers event:");
      setGameData(prev => ({
        tournament: prev?.tournament || {
          id: tournamentIdNum,
          title: `Tournament ${tournamentIdNum}`,
          date: new Date(),
          time: null,
          venue: null,
          status: 'active',
          max_players: null,
          start_points: 0
        },
        players
      }));
      setLoading(false);
    });

    // Handle tournament updates
    socket.on("tournament:updated", (event: { data: { tournament: Tournament } }) => {
      console.log("Tournament updated:", event.data.tournament);
      setGameData(prev => ({
        ...prev!,
        tournament: event.data.tournament
      }));
    });

    // Handle player updates
    socket.on("players:updated", (event: { data: { players: Player[] } }) => {
      console.log("Players updated:", event.data.players);
      setGameData(prev => ({
        ...prev!,
        players: event.data.players
      }));
    });

    // Handle player elimination
    socket.on("player:eliminated", (event: { data: { player: Player, eliminatedBy: Player, position: number } }) => {
      console.log("Player eliminated:", event.data);
      // The players:updated event will follow, so we don't need to update here
    });

    // Handle player added
    socket.on("player:added", (event: { data: { player: Player } }) => {
      console.log("Player added:", event.data.player);
      // The players:updated event will follow, so we don't need to update here
    });

    // Handle venue updates
    socket.on("venue:updated", (event: { data: { venue: Tournament['venue'] } }) => {
      console.log("Venue updated:", event.data.venue);
      setGameData(prev => ({
        ...prev!,
        tournament: {
          ...prev!.tournament,
          venue: event.data.venue
        }
      }));
    });

    // Error handling
    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setError("Failed to connect to real-time updates");
      setLoading(false);
    });

    return () => {
      socket.off("connect");
      socket.off("updatePlayers");
      socket.off("tournament:updated");
      socket.off("players:updated");
      socket.off("player:eliminated");
      socket.off("player:added");
      socket.off("venue:updated");
      socket.off("connect_error");
    };
  }, [tournamentIdNum]);

  // Computed values (calculated locally)
  const computedStats = gameData ? {
    totalPlayers: gameData.players.length,
    activePlayers: gameData.players.filter(p => p.is_active).length,
    eliminatedPlayers: gameData.players.filter(p => !p.is_active).length,
    playersRemaining: gameData.players.filter(p => p.is_active).length,
  } : null;

  return {
    gameData,
    computedStats,
    loading,
    error
  };
}