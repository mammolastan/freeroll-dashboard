// app/admin/tournament-entry/screens/Screen2_GameTimer/GameTimerScreen.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { MinimalGameTimer } from './MinimalGameTimer';
import { getBlindScheduleDisplayName } from '@/lib/blind-schedule-label';
import { ScreenTabs } from '../../components/ScreenTabs';
import { ScreenNumber } from '../../hooks/useScreenRouter';

interface TournamentDraft {
  id: number;
  tournament_date: string;
  director_name: string;
  venue: string | null;
  venue_id: number | null;
  start_points: number;
  status: 'in_progress' | 'finalized' | 'integrated';
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
  added_by?: 'admin' | 'self_checkin';
  checked_in_at?: string;
  player_nickname?: string | null;
}

interface GameTimerScreenProps {
  currentDraft: TournamentDraft | null;
  players: Player[];
  currentScreen: ScreenNumber;
  onScreenChange: (screen: ScreenNumber) => void;
}

export function GameTimerScreen({
  currentDraft,
  players,
  currentScreen,
  onScreenChange
}: GameTimerScreenProps) {
  const [blindScheduleRows, setBlindScheduleRows] = useState<
    { id: number; name: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/blind-schedules")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setBlindScheduleRows(
            data.map((row: { id: number; name: string }) => ({
              id: Number(row.id),
              name: row.name,
            })),
          );
        }
      })
      .catch(() => setBlindScheduleRows([]));
  }, []);

  const blindScheduleName = getBlindScheduleDisplayName(
    currentDraft,
    blindScheduleRows,
  );

  // Calculate players remaining (those without ko_position)
  const playersRemaining = players.filter(p => p.ko_position === null).length;

  if (!currentDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cyan-300 mb-4">No Active Tournament</h1>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-8">
      {/* Screen Navigation Tabs */}
      <ScreenTabs currentScreen={currentScreen} onScreenChange={onScreenChange} />

      {/* Minimal Game Timer - Full Screen Display */}
      <div className="w-full flex-1 flex items-center justify-center">
        <MinimalGameTimer
          tournamentId={currentDraft.id}
          playersRemaining={playersRemaining}
          blindScheduleName={blindScheduleName}
        />
      </div>
    </div>
  );
}
