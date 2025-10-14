// app/admin/tournament-entry/screens/Screen3_PlayerCheckIn/PlayerCheckInScreen.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Check, UserPlus, Search, X } from 'lucide-react';
import { PlayerSearchDropdown, PlayerSearchResult as PlayerSearchDropdownResult } from '@/components/PlayerSearchDropdown';

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

interface PlayerSearchResult {
  Name: string;
  UID: string;
  nickname: string | null;
  TotalGames?: number;
  TotalPoints?: number;
}

interface PlayerCheckInScreenProps {
  currentDraft: TournamentDraft | null;
  players: Player[];
  onDataChange: () => void;
}

export function PlayerCheckInScreen({ currentDraft, players, onDataChange }: PlayerCheckInScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  console.log('[Screen3] RENDER - showDropdown:', showDropdown, 'searchResults:', searchResults.length, 'searchQuery:', searchQuery);

  // Auto-clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Search for existing players
  const searchPlayers = async (query: string) => {
    console.log('[Screen3] searchPlayers called with query:', query);
    if (query.trim().length < 2) {
      console.log('[Screen3] Query too short, hiding dropdown');
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/players/search?q=${encodeURIComponent(query)}&name=true`);
      if (response.ok) {
        const data = await response.json();
        console.log('[Screen3] Search results:', data.length, 'results');
        setSearchResults(data);
        // Always show dropdown when we have results and are typing
        if (data.length > 0) {
          console.log('[Screen3] Setting showDropdown to TRUE');
          setShowDropdown(true);
        } else {
          console.log('[Screen3] No results, hiding dropdown');
          setShowDropdown(false);
        }
      } else {
        console.log('[Screen3] Search request failed');
        setSearchResults([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.error('Error searching players:', error);
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search handler
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      searchPlayers(value);
    }, 300);
  };

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    console.log('[Screen3] Click-outside effect - showDropdown:', showDropdown);
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking on the input or dropdown
      if (
        inputRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        console.log('[Screen3] Click inside input/dropdown, keeping open');
        return;
      }

      console.log('[Screen3] Click outside, closing dropdown');
      setShowDropdown(false);
    };

    // Add listener immediately
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleCheckIn = async (playerResult: PlayerSearchResult) => {
    if (!currentDraft) return;

    setIsSubmitting(true);
    setShowDropdown(false);
    try {
      const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerResult.Name,
          player_uid: playerResult.UID,
          is_new_player: false,
          player_nickname: playerResult.nickname,
        }),
      });

      if (response.ok) {
        setSuccessMessage(`${playerResult.Name} checked in successfully!`);
        setSearchQuery('');
        setSearchResults([]);
        onDataChange();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to check in player');
      }
    } catch (error) {
      console.error('Error checking in player:', error);
      alert('Error checking in player. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewPlayerSubmit = async () => {
    if (!currentDraft || !newPlayerName.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: newPlayerName.trim(),
          player_uid: null,
          is_new_player: true,
        }),
      });

      if (response.ok) {
        setSuccessMessage(`${newPlayerName} registered and checked in!`);
        setNewPlayerName('');
        setShowNewPlayerForm(false);
        onDataChange();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to register player');
      }
    } catch (error) {
      console.error('Error registering player:', error);
      alert('Error registering player. Please try again.');
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

        {/* Success Message */}
        {successMessage && (
          <div className="mb-8 p-6 bg-green-600/20 border-2 border-green-500 rounded-xl text-center">
            <div className="flex items-center justify-center gap-3 text-2xl font-bold text-green-400">
              <Check size={32} />
              {successMessage}
            </div>
          </div>
        )}

        {/* Search Section */}
        {!showNewPlayerForm && (
          <div className="space-y-6">
            <div className="relative dropdown-container">
              <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 z-10 pointer-events-none" size={32} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                placeholder="Search for your name..."
                className="w-full pl-20 pr-6 py-6 text-2xl bg-gray-800/80 border-2 border-cyan-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 focus:border-cyan-500"
                autoComplete="off"
              />

              {/* Dropdown with Search Results */}
              {showDropdown && searchResults.length > 0 && (
                <div ref={dropdownRef} className="absolute z-50 w-full mt-2 bg-gray-800 border-2 border-cyan-500/50 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto">
                  {searchResults.map((result) => {
                    const alreadyCheckedIn = players.some(p => p.player_uid === result.UID);

                    return (
                      <button
                        key={result.UID}
                        onClick={() => !alreadyCheckedIn && handleCheckIn(result)}
                        disabled={alreadyCheckedIn || isSubmitting}
                        className={`w-full p-6 text-left transition-all border-b-2 border-gray-700/50 last:border-b-0 ${
                          alreadyCheckedIn
                            ? 'bg-gray-900/40 cursor-not-allowed opacity-60'
                            : 'hover:bg-gray-700/80 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold text-white mb-1">
                              {result.Name}
                            </div>
                            {result.nickname && (
                              <div className="text-lg text-cyan-400">
                                &quot;{result.nickname}&quot;
                              </div>
                            )}
                            {result.TotalGames && (
                              <div className="text-sm text-gray-400 mt-2">
                                {result.TotalGames} games • {Number(result.TotalPoints || 0).toFixed(1)} points
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            {alreadyCheckedIn ? (
                              <div className="flex items-center gap-2 text-green-400 text-xl font-bold">
                                <Check size={28} />
                                Checked In
                              </div>
                            ) : (
                              <div className="text-cyan-400 text-xl font-bold">
                                Tap to Check In
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* No Results */}
            {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xl text-gray-400 mb-6">
                  No players found matching &quot;{searchQuery}&quot;
                </p>
                <button
                  onClick={() => {
                    setNewPlayerName(searchQuery);
                    setShowNewPlayerForm(true);
                  }}
                  className="px-8 py-4 text-xl font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-all border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                >
                  <UserPlus className="inline mr-2" size={24} />
                  Register as New Player
                </button>
              </div>
            )}

            {/* New Player Button */}
            {searchQuery.length === 0 && (
              <div className="text-center py-8">
                <button
                  onClick={() => setShowNewPlayerForm(true)}
                  className="px-8 py-4 text-xl font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-all border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                >
                  <UserPlus className="inline mr-2" size={24} />
                  New Player Registration
                </button>
              </div>
            )}
          </div>
        )}

        {/* New Player Form */}
        {showNewPlayerForm && (
          <div className="space-y-6">
            <div className="bg-gray-800/80 border-2 border-purple-500/50 rounded-xl p-8">
              <h2 className="text-3xl font-bold text-purple-400 mb-6 text-center">
                New Player Registration
              </h2>

              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-6 py-6 text-2xl bg-gray-900 border-2 border-purple-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-purple-500/50 focus:border-purple-500 mb-6"
                autoFocus
              />

              <div className="flex gap-4">
                <button
                  onClick={handleNewPlayerSubmit}
                  disabled={!newPlayerName.trim() || isSubmitting}
                  className="flex-1 px-8 py-4 text-xl font-bold bg-green-600 text-white rounded-xl hover:bg-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                >
                  <Check className="inline mr-2" size={24} />
                  Register & Check In
                </button>
                <button
                  onClick={() => {
                    setShowNewPlayerForm(false);
                    setNewPlayerName('');
                  }}
                  className="px-8 py-4 text-xl font-bold bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-all border-2 border-gray-600"
                >
                  <X className="inline mr-2" size={24} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recently Checked In Players */}
        {players.length > 0 && (
          <div className="mt-12">
            <h3 className="text-2xl font-bold text-gray-400 mb-4">
              Recently Checked In
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {players
                .filter(p => p.checked_in_at)
                .sort((a, b) => new Date(b.checked_in_at!).getTime() - new Date(a.checked_in_at!).getTime())
                .slice(0, 12)
                .map((player) => (
                  <div
                    key={player.id}
                    className="p-4 bg-gray-800/60 border border-green-500/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-green-400 flex-shrink-0" />
                      <div className="text-white font-medium truncate">
                        {player.player_name}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
