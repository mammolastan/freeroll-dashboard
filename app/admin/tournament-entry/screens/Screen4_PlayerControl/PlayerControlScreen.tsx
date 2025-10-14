// app/admin/tournament-entry/screens/Screen4_PlayerControl/PlayerControlScreen.tsx

'use client';

import React, { useState } from 'react';
import { Target, Users, Trophy, X } from 'lucide-react';

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

interface PlayerControlScreenProps {
  currentDraft: TournamentDraft | null;
  players: Player[];
  onDataChange: () => void;
}

export function PlayerControlScreen({ currentDraft, players, onDataChange }: PlayerControlScreenProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedHitman, setSelectedHitman] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Players are knocked out when they have a ko_position (not null)
  const remainingPlayers = players.filter(p => p.ko_position === null);
  const knockedOutPlayers = players
    .filter(p => p.ko_position !== null)
    .sort((a, b) => (b.ko_position || 0) - (a.ko_position || 0));

  const handleKnockout = async (player: Player, hitmanName: string) => {
    if (!currentDraft || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Calculate next knockout position
      const maxKoPosition = Math.max(0, ...players.map(p => p.ko_position || 0));
      const nextKoPosition = maxKoPosition + 1;
      const remainingCount = remainingPlayers.length;
      const placement = remainingCount;

      const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players/${player.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: player.player_name,
          hitman_name: hitmanName || null,
          ko_position: nextKoPosition,
          placement: placement,
        }),
      });

      if (response.ok) {
        setSelectedPlayer(null);
        setSelectedHitman('');
        onDataChange();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to record knockout');
      }
    } catch (error) {
      console.error('Error recording knockout:', error);
      alert('Error recording knockout. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoKnockout = async (player: Player) => {
    if (!currentDraft || isSubmitting) return;

    if (!confirm(`Undo knockout for ${player.player_name}?`)) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players/${player.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: player.player_name,
          hitman_name: null,
          ko_position: null,
          placement: null,
        }),
      });

      if (response.ok) {
        onDataChange();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to undo knockout');
      }
    } catch (error) {
      console.error('Error undoing knockout:', error);
      alert('Error undoing knockout. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-cyan-300 mb-2 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
          Player Control
        </h1>
        <p className="text-xl text-gray-400">
          {currentDraft.venue} - {new Date(currentDraft.tournament_date).toLocaleDateString()}
        </p>
      </div>

      {/* Knockout Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-cyan-500 rounded-xl p-8 max-w-2xl w-full">
            <h2 className="text-3xl font-bold text-cyan-300 mb-6 text-center">
              Record Knockout
            </h2>

            <div className="mb-6 text-center">
              <div className="text-2xl font-bold text-white mb-2">
                {selectedPlayer.player_name}
              </div>
              <div className="text-lg text-gray-400">
                Placement: #{remainingPlayers.length}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-300 text-lg mb-3">
                Who knocked them out? (Optional)
              </label>
              <select
                value={selectedHitman}
                onChange={(e) => setSelectedHitman(e.target.value)}
                className="w-full px-4 py-3 text-xl bg-gray-800 border-2 border-cyan-500/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select hitman (optional)</option>
                {remainingPlayers
                  .filter(p => p.id !== selectedPlayer.id)
                  .map(p => (
                    <option key={p.id} value={p.player_name}>
                      {p.player_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handleKnockout(selectedPlayer, selectedHitman)}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 text-xl font-bold bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all disabled:opacity-50 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              >
                <Target className="inline mr-2" size={24} />
                Confirm Knockout
              </button>
              <button
                onClick={() => {
                  setSelectedPlayer(null);
                  setSelectedHitman('');
                }}
                disabled={isSubmitting}
                className="px-6 py-3 text-xl font-bold bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all border-2 border-gray-600"
              >
                <X className="inline mr-2" size={24} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split View: Remaining vs Knocked Out */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Remaining Players */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Users className="text-green-400" size={32} />
            <h2 className="text-3xl font-bold text-green-400">
              Remaining ({remainingPlayers.length})
            </h2>
          </div>

          <div className="space-y-3">
            {remainingPlayers.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xl">
                No players remaining
              </div>
            ) : (
              remainingPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  disabled={isSubmitting}
                  className="w-full p-6 bg-gray-800/80 border-2 border-green-500/50 rounded-xl hover:border-green-500 hover:bg-gray-700/80 transition-all text-left group"
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
                      ) : ''}
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
            <Trophy className="text-red-400" size={32} />
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
                        <div className="text-xl font-bold text-white">
                          {player.player_name}
                        </div>
                      </div>
                      {player.hitman_name && (
                        <div className="text-gray-400 ml-16">
                          <Target size={16} className="inline mr-1" />
                          Knocked out by: <span className="text-cyan-400 font-semibold">{player.hitman_name}</span>
                        </div>
                      )}
                      {player.placement !== null && (
                        <div className="text-gray-500 text-sm ml-16 mt-1">
                          Final Placement: #{player.placement}
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

      {/* Stats */}
      <div className="max-w-7xl mx-auto mt-12 grid grid-cols-3 gap-6">
        <div className="bg-gray-800/60 border border-cyan-500/30 rounded-xl p-6 text-center">
          <div className="text-4xl font-bold text-cyan-400 mb-2">
            {players.length}
          </div>
          <div className="text-gray-400">Total Players</div>
        </div>
        <div className="bg-gray-800/60 border border-green-500/30 rounded-xl p-6 text-center">
          <div className="text-4xl font-bold text-green-400 mb-2">
            {remainingPlayers.length}
          </div>
          <div className="text-gray-400">Still In</div>
        </div>
        <div className="bg-gray-800/60 border border-red-500/30 rounded-xl p-6 text-center">
          <div className="text-4xl font-bold text-red-400 mb-2">
            {knockedOutPlayers.length}
          </div>
          <div className="text-gray-400">Knocked Out</div>
        </div>
      </div>
    </div>
  );
}
