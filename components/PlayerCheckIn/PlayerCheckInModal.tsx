// components/PlayerCheckIn/PlayerCheckInModal.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, User, LogIn } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
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
  checkInToken: string;
  leagueSlug?: string | null;
  onSuccess?: (playerName: string) => void;
}

export function PlayerCheckInModal({
  isOpen,
  onClose,
  checkInToken,
  leagueSlug,
  onSuccess
}: PlayerCheckInModalProps) {
  const { data: session, status } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showGuestCheckIn, setShowGuestCheckIn] = useState(false);

  // Fetch checked-in players when modal opens
  useEffect(() => {
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

    if (isOpen) {
      fetchCheckedInPlayers();
      setSuccessMessage('');
      setShowGuestCheckIn(false);
    }
  }, [isOpen, checkInToken]);

  // Check if the signed-in user is already checked in
  const isUserAlreadyCheckedIn = session?.user?.uid
    ? players.some(p => p.player_uid === session.user.uid)
    : false;

  // Quick check-in for signed-in users
  const handleQuickCheckIn = async () => {
    if (!session?.user?.uid || !session?.user?.name) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/checkin/${checkInToken}/players`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_player_uid: session.user.uid,
          entered_name: session.user.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check in');
      }

      const displayName = session.user.nickname || session.user.name;
      setSuccessMessage(`Welcome ${displayName}!`);

      // Close modal after brief delay to show success
      setTimeout(() => {
        onSuccess?.(displayName);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error checking in:', error);
      alert(error instanceof Error ? error.message : 'Error checking in. Please try again.');
    } finally {
      setIsSubmitting(false);
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

  const handleSuccess = (playerName: string) => {
    onSuccess?.(playerName);
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
          {loading || status === 'loading' ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto shadow-[0_0_20px_rgba(6,182,212,0.5)]"></div>
              <p className="mt-4 text-cyan-300 text-xl">Loading...</p>
            </div>
          ) : successMessage ? (
            // Success Message
            <div className="text-center py-12">
              <div className="p-6 bg-green-600/20 border-2 border-green-500 rounded-xl inline-block">
                <div className="flex items-center gap-3 text-2xl font-bold text-green-400">
                  <Check size={32} />
                  {successMessage}
                </div>
              </div>
            </div>
          ) : session && !showGuestCheckIn ? (
            // Signed-in user flow
            <div className="space-y-6">
              {isUserAlreadyCheckedIn ? (
                // Already checked in
                <div className="text-center py-8">
                  <div className="p-6 bg-green-600/20 border-2 border-green-500 rounded-xl inline-block mb-6">
                    <div className="flex items-center gap-3 text-2xl font-bold text-green-400">
                      <Check size={32} />
                      You&apos;re Already Checked In!
                    </div>
                  </div>
                  <p className="text-gray-400 text-lg mb-6">
                    {session.user.nickname || session.user.name} is registered for this tournament.
                  </p>
                  <button
                    onClick={() => setShowGuestCheckIn(true)}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors underline text-lg"
                  >
                    Check in someone else
                  </button>
                </div>
              ) : (
                // Quick check-in form
                <div className="space-y-6">
                  <div className="bg-gray-800/80 border-2 border-cyan-500/50 rounded-xl p-6 md:p-8">
                    <h3 className="text-xl md:text-2xl font-bold text-cyan-300 mb-6 text-center">
                      Confirm Your Check-In
                    </h3>

                    {/* User Info Display */}
                    <div className="flex items-center gap-4 p-4 bg-gray-900/60 rounded-xl border border-gray-700 mb-6">
                      {session.user.image ? (
                        <div
                          className="w-16 h-16 rounded-full bg-slate-600 bg-cover bg-center flex-shrink-0"
                          style={{ backgroundImage: `url(${session.user.image})` }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-cyan-600/30 flex items-center justify-center flex-shrink-0 border-2 border-cyan-500/50">
                          <User size={32} className="text-cyan-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xl md:text-2xl font-bold text-white truncate">
                          {session.user.name}
                        </div>
                        {session.user.nickname && (
                          <div className="text-lg text-cyan-400">
                            &quot;{session.user.nickname}&quot;
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Check In Button */}
                    <button
                      onClick={handleQuickCheckIn}
                      disabled={isSubmitting}
                      className="w-full px-6 py-4 text-xl font-bold bg-green-600 text-white rounded-xl hover:bg-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Checking In...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Check size={24} />
                          Check In to Tournament
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Option to check in as someone else */}
                  <div className="text-center">
                    <button
                      onClick={() => setShowGuestCheckIn(true)}
                      className="text-gray-400 hover:text-cyan-400 transition-colors underline"
                    >
                      Check in someone else instead
                    </button>
                  </div>
                </div>
              )}

              {/* Recently Checked In Players */}
              {players.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg md:text-xl font-bold text-gray-400 mb-3">
                    Recently Checked In ({players.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                    {players
                      .filter((p) => p.checked_in_at)
                      .sort(
                        (a, b) =>
                          new Date(b.checked_in_at!).getTime() -
                          new Date(a.checked_in_at!).getTime()
                      )
                      .slice(0, 12)
                      .map((player) => (
                        <div
                          key={player.id}
                          className="p-2 md:p-3 bg-gray-800/60 border border-green-500/30 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-green-400 flex-shrink-0" />
                            <div className="text-sm md:text-base text-white font-medium truncate">
                              {player.player_nickname || player.player_name}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Guest/search flow (original behavior)
            <div className="space-y-6">
              {/* Sign in prompt for guests */}
              {!session && (
                <div className="mb-6 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-xl">
                  <div className="flex items-center gap-3 text-cyan-300">
                    <LogIn size={20} />
                    <span>
                      <Link href="/login" className="underline hover:text-cyan-200">
                        Sign in
                      </Link>{' '}
                      for faster check-ins next time!
                    </span>
                  </div>
                </div>
              )}

              {showGuestCheckIn && session && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowGuestCheckIn(false)}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-2"
                  >
                    ← Back to your check-in
                  </button>
                </div>
              )}

              <PlayerCheckInCore
                players={players}
                onCheckIn={handleCheckIn}
                onSuccess={handleSuccess}
                showRecentlyCheckedIn={true}
                leagueSlug={leagueSlug}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
