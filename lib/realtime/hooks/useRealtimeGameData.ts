// lib/realtime/hooks/useRealtimeGameData.ts

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { socket } from '@/lib/socketClient';
import { Tournament, Player, GameViewData } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function useRealtimeGameData(tournamentId: string | number) {
  const [gameData, setGameData] = useState<GameViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const hasFetched = useRef(false);
  const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Manual reconnect function
  const manualReconnect = useCallback(() => {
    console.log('[Socket] Manual reconnect triggered');
    setConnectionStatus('reconnecting');

    // Force disconnect and reconnect
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();
  }, []);

  // Socket.IO real-time updates
  useEffect(() => {
    if (!tournamentIdNum) return;

    // Clear any existing fallback interval
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    // Connect and join room
    socket.on("connect", () => {
      console.log("Connected to server with ID:", socket.id);
      setConnectionStatus('connected');
      setError(null); // Clear any previous errors
      setReconnectAttempt(0);

      // Clear fallback reconnect interval on successful connection
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }

      socket.emit("joinRoom", tournamentIdNum.toString());

      // Refresh data on reconnect to catch any missed updates
      fetchGameData().then(data => {
        if (data) setGameData(data);
      }).catch(err => {
        console.error('[GameData] Error refreshing after reconnect:', err);
      });
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      setConnectionStatus('disconnected');

      // Start fallback reconnection polling every 10 seconds
      // This catches cases where Socket.IO's built-in reconnection fails
      if (!reconnectIntervalRef.current) {
        reconnectIntervalRef.current = setInterval(() => {
          if (!socket.connected) {
            console.log('[Socket] Fallback reconnection attempt...');
            setReconnectAttempt(prev => prev + 1);
            socket.connect();
          } else {
            // Connected, clear the interval
            if (reconnectIntervalRef.current) {
              clearInterval(reconnectIntervalRef.current);
              reconnectIntervalRef.current = null;
            }
          }
        }, 10000); // Try every 10 seconds
      }
    });

    // Handle reconnection attempts (from Socket.IO's built-in reconnection)
    socket.io.on("reconnect_attempt", (attempt) => {
      console.log(`Reconnection attempt ${attempt}...`);
      setConnectionStatus('reconnecting');
      setReconnectAttempt(attempt);
    });

    // Handle successful reconnection
    socket.io.on("reconnect", () => {
      console.log('[Socket] Reconnected successfully');
      setConnectionStatus('connected');
      setReconnectAttempt(0);
    });

    // Handle reconnection failure - but don't give up, our fallback will keep trying
    socket.io.on("reconnect_failed", () => {
      console.error("Socket.IO reconnect failed, fallback will keep trying...");
      // Don't set error - our fallback interval will keep trying
    });

    // If already connected, join room immediately
    if (socket.connected) {
      console.log("Already connected, joining room immediately");
      setConnectionStatus('connected');
      socket.emit("joinRoom", tournamentIdNum.toString());
    } else {
      // Not connected, try to connect
      socket.connect();
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
          start_points: 0,
          td: null,
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
      // Socket.IO will auto-reconnect, so just update status
      // The initial load error is handled separately via HTTP fetch
      setConnectionStatus('reconnecting');
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("updatePlayers");
      socket.off("tournament:updated");
      socket.off("players:updated");
      socket.off("player:eliminated");
      socket.off("player:added");
      socket.off("venue:updated");
      socket.off("connect_error");
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect");
      socket.io.off("reconnect_failed");

      // Clear fallback interval on cleanup
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
    };
  }, [tournamentIdNum, fetchGameData]);

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
    error,
    connectionStatus,
    reconnectAttempt,
    manualReconnect,
  };
}