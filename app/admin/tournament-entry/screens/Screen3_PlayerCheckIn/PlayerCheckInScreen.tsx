// app/admin/tournament-entry/screens/Screen3_PlayerCheckIn/PlayerCheckInScreen.tsx

'use client';

import React from 'react';
import { PlayerCheckInCore } from '@/components/PlayerCheckIn/PlayerCheckInCore';

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

interface PlayerCheckInScreenProps {
  currentDraft: TournamentDraft | null;
  players: Player[];
  onDataChange: () => void;
}

export function PlayerCheckInScreen({ currentDraft, players, onDataChange }: PlayerCheckInScreenProps) {
  const handleCheckIn = async (playerData: {
    player_name: string;
    player_uid: string | null;
    is_new_player: boolean;
    player_nickname?: string | null;
  }) => {
    if (!currentDraft) throw new Error('No active tournament');

    const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(playerData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to check in player');
    }

    onDataChange();
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-cyan-300 mb-4 drop-shadow-[0_0_25px_rgba(6,182,212,0.5)]">
            Player Check-In
          </h1>
          <p className="text-2xl text-gray-400">
            {currentDraft.venue} - {new Date(currentDraft.tournament_date).toLocaleDateString()}
          </p>
          <div className="mt-4 text-xl text-purple-400">
            {players.length} Players Registered
          </div>
        </div>

        <PlayerCheckInCore
          players={players}
          onCheckIn={handleCheckIn}
          onSuccess={onDataChange}
          showRecentlyCheckedIn={true}
        />
      </div>
    </div>
  );
}
