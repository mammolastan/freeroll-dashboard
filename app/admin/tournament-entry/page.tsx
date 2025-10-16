// app/admin/tournament-entry/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useScreenRouter } from './hooks/useScreenRouter';
import { ScreenIndicator } from './components/ScreenIndicator';
import { FullAdminScreen } from './screens/Screen1_FullAdmin/FullAdminScreen';
import { GameTimerScreen } from './screens/Screen2_GameTimer/GameTimerScreen';
import { PlayerCheckInScreen } from './screens/Screen3_PlayerCheckIn/PlayerCheckInScreen';
import { PlayerControlScreen } from './screens/Screen4_PlayerControl/PlayerControlScreen';

interface TournamentDraft {
  id: number;
  tournament_date: string;
  director_name: string;
  venue: string;
  start_points: number;
  status: 'in_progress' | 'finalized' | 'integrated';
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
  added_by?: 'admin' | 'self_checkin';
  checked_in_at?: string;
  player_nickname?: string | null;
}

export default function TournamentEntryPage() {
  const { currentScreen } = useScreenRouter(1);

  // Authentication state (lifted from Screen1)
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // View state - determines whether to show tournament list or entry view
  const [currentView, setCurrentView] = useState<'welcome' | 'entry'>('welcome');

  // Shared state for all screens
  const [currentDraft, setCurrentDraft] = useState<TournamentDraft | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [dataVersion, setDataVersion] = useState(0);

  // Load tournament and player data (only when authenticated)
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // Load tournaments to find the active one
      const tournamentsResponse = await fetch('/api/tournament-drafts?limit=20');
      if (tournamentsResponse.ok) {
        const tournaments: TournamentDraft[] = await tournamentsResponse.json();

        // Only auto-select if no tournament is currently selected
        if (!currentDraft) {
          // Find the most recent in_progress tournament
          const activeTournament = tournaments.find(t => t.status === 'in_progress');

          if (activeTournament) {
            setCurrentDraft(activeTournament);

            // Load players for this tournament
            const playersResponse = await fetch(`/api/tournament-drafts/${activeTournament.id}/players`);
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
          const playersResponse = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`);
          if (playersResponse.ok) {
            const playersData: Player[] = await playersResponse.json();
            setPlayers(playersData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [isAuthenticated, currentDraft]);

  // Load data when authenticated or when data version changes
  useEffect(() => {
    loadData();
  }, [loadData, dataVersion]);

  // Callback for screens to trigger data reload
  const handleDataChange = useCallback(() => {
    setDataVersion(prev => prev + 1);
  }, []);

  // Callback for Screen1 to update current draft selection
  const handleDraftChange = useCallback((draft: TournamentDraft | null) => {
    setCurrentDraft(draft);
    if (draft) {
      // When a draft is selected, switch to entry view
      setCurrentView('entry');
      // Reload players for this draft
      fetch(`/api/tournament-drafts/${draft.id}/players`)
        .then(res => res.json())
        .then(data => setPlayers(data))
        .catch(err => console.error('Error loading players:', err));
    } else {
      // When draft is cleared, go back to welcome view
      setCurrentView('welcome');
      setPlayers([]);
    }
  }, []);

  return (
    <>
      <ScreenIndicator currentScreen={currentScreen} />

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
        />
      )}

      {currentScreen === 2 && (
        <GameTimerScreen
          currentDraft={currentDraft}
          players={players}
        />
      )}

      {currentScreen === 3 && (
        <PlayerCheckInScreen
          currentDraft={currentDraft}
          players={players}
          onDataChange={handleDataChange}
        />
      )}

      {currentScreen === 4 && (
        <PlayerControlScreen
          currentDraft={currentDraft}
          players={players}
          onDataChange={handleDataChange}
        />
      )}
    </>
  );
}
