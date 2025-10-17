// components/PlayerCheckIn/PlayerCheckInCore.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Check, UserPlus, Search, X } from 'lucide-react';

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

interface PlayerCheckInCoreProps {
  players: Player[];
  onCheckIn: (playerData: {
    player_name: string;
    player_uid: string | null;
    is_new_player: boolean;
    player_nickname?: string | null;
  }) => Promise<void>;
  onSuccess?: () => void;
  showRecentlyCheckedIn?: boolean;
}

export function PlayerCheckInCore({
  players,
  onCheckIn,
  onSuccess,
  showRecentlyCheckedIn = true
}: PlayerCheckInCoreProps) {
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

  // Auto-clear success message after 2 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Search for existing players
  const searchPlayers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/players/search?q=${encodeURIComponent(query)}&name=true`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
        if (data.length > 0) {
          setShowDropdown(true);
        } else {
          setShowDropdown(false);
        }
      } else {
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
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        inputRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleCheckIn = async (playerResult: PlayerSearchResult) => {
    setIsSubmitting(true);
    setShowDropdown(false);
    try {
      await onCheckIn({
        player_name: playerResult.Name,
        player_uid: playerResult.UID,
        is_new_player: false,
        player_nickname: playerResult.nickname,
      });

      const welcomeName = playerResult.nickname || playerResult.Name;
      setSuccessMessage(`Welcome ${welcomeName}!`);
      setSearchQuery('');
      setSearchResults([]);

      // Call onSuccess after a delay to allow the success message to be visible
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('Error checking in player:', error);
      alert('Error checking in player. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewPlayerSubmit = async () => {
    if (!newPlayerName.trim()) return;

    setIsSubmitting(true);
    try {
      await onCheckIn({
        player_name: newPlayerName.trim(),
        player_uid: null,
        is_new_player: true,
      });

      setSuccessMessage(`Welcome ${newPlayerName}!`);
      setNewPlayerName('');
      setShowNewPlayerForm(false);

      // Call onSuccess after a delay to allow the success message to be visible
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('Error registering player:', error);
      alert('Error registering player. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="p-6 bg-green-600/20 border-2 border-green-500 rounded-xl text-center">
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
                      className={`w-full p-6 text-left transition-all border-b-2 border-gray-700/50 last:border-b-0 ${alreadyCheckedIn
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
                              {result.TotalGames > 100 ? '100+' : result.TotalGames} games
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
              autoComplete="off"
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
      {showRecentlyCheckedIn && players.length > 0 && (
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
                      {player.player_nickname || player.player_name}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
