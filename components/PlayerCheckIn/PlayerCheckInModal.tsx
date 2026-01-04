// components/PlayerCheckIn/PlayerCheckInModal.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PlayerCheckInCore } from './PlayerCheckInCore';

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

interface PlayerCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentToken: string;
  checkInToken: string;
  onSuccess?: () => void;
}

export function PlayerCheckInModal({
  isOpen,
  onClose,
  tournamentToken,
  checkInToken,
  onSuccess
}: PlayerCheckInModalProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [venue] = useState('');
  const [tournamentDate] = useState('');

  // Fetch checked-in players when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCheckedInPlayers();
    }
  }, [isOpen, tournamentToken]);

  const fetchCheckedInPlayers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/checkin/${checkInToken}/players`);
      if (response.ok) {
        const data = await response.json();
        setPlayers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching checked-in players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (playerData: {
    player_name: string;
    player_uid: string | null;
    is_new_player: boolean;
    player_nickname?: string | null;
  }) => {
    let response;

    if (playerData.is_new_player) {
      // New player check-in
      response = await fetch(`/api/checkin/${checkInToken}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerData.player_name,
          force_new_player: true
        })
      });
    } else {
      // Existing player check-in
      response = await fetch(`/api/checkin/${checkInToken}/players`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_player_uid: playerData.player_uid,
          entered_name: playerData.player_name
        })
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to check in player');
    }

    // Don't refresh immediately - let the success message show first
    // Refresh will happen when modal reopens
  };

  const handleSuccess = () => {
    onSuccess?.();
    // Close immediately - the delay is already handled in PlayerCheckInCore
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl shadow-2xl w-full max-w-4xl min-h-[600px] max-h-[90vh] overflow-y-auto border-2 border-cyan-500/30">
        {/* Header */}
        <div className="sticky top-0 bg-slate-950/95 backdrop-blur-sm border-b-2 border-cyan-500/30 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-4xl font-bold text-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              Player Check-In
            </h2>
            {venue && tournamentDate && (
              <p className="text-xl text-gray-400 mt-2">
                {venue} - {new Date(tournamentDate).toLocaleDateString()}
              </p>
            )}
            {players.length > 0 && (
              <div className="mt-2 text-lg text-purple-400">
                {players.length} Players Registered
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-cyan-400 transition-colors p-2"
          >
            <X size={32} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto shadow-[0_0_20px_rgba(6,182,212,0.5)]"></div>
              <p className="mt-4 text-cyan-300 text-xl">Loading...</p>
            </div>
          ) : (
            <PlayerCheckInCore
              players={players}
              onCheckIn={handleCheckIn}
              onSuccess={handleSuccess}
              showRecentlyCheckedIn={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
