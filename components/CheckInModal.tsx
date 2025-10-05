'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { PlayerSearchDropdown, PlayerSearchResult, CheckedInPlayer } from './PlayerSearchDropdown';

interface PlayerSuggestion {
    name: string;
    uid: string;
    nickname: string | null;
}

interface CheckInResponse {
    type: 'success' | 'suggestions' | 'error';
    player?: any;
    suggestions?: PlayerSuggestion[];
    entered_name?: string;
    message?: string;
    error?: string;
}

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    onSuccess: () => void;
}

export function CheckInModal({ isOpen, onClose, token, onSuccess }: CheckInModalProps) {
    const [playerName, setPlayerName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [step, setStep] = useState<'enter_name' | 'success'>('enter_name');

    // New player selection state
    const [isNewPlayer, setIsNewPlayer] = useState<boolean | null>(null);
    const [selectedExistingPlayer, setSelectedExistingPlayer] = useState<PlayerSearchResult | null>(null);

    // Player search dropdown states
    const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Checked-in players state
    const [checkedInPlayers, setCheckedInPlayers] = useState<CheckedInPlayer[]>([]);

    // Use ref to track debounce timeout
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch checked-in players when modal opens
    useEffect(() => {
        if (isOpen) {
            setPlayerName('');
            setError('');
            setSuccess('');
            setStep('enter_name');
            setIsNewPlayer(null);
            setSelectedExistingPlayer(null);
            setSearchResults([]);
            setShowDropdown(false);

            // Fetch checked-in players
            const fetchCheckedInPlayers = async () => {
                try {
                    const response = await fetch(`/api/checkin/${token}/players`);
                    if (response.ok) {
                        const data = await response.json();
                        // The API returns an array directly, not an object with a players property
                        setCheckedInPlayers(Array.isArray(data) ? data : []);
                    }
                } catch (error) {
                    console.error('Error fetching checked-in players:', error);
                }
            };

            fetchCheckedInPlayers();
        }
    }, [isOpen, token]);

    // Search for players
    const searchPlayers = async (query: string) => {
        if (query.trim().length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(`/api/players/search?q=${encodeURIComponent(query)}&name=true&limit=10`);
            if (response.ok) {
                const data = await response.json();
                setSearchResults(data);
                setShowDropdown(data.length > 0);
            } else {
                console.error('Search request failed:', response.status);
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
        setPlayerName(value);

        // Reset existing player selection when typing
        if (selectedExistingPlayer) {
            setSelectedExistingPlayer(null);
            setIsNewPlayer(null);
        }

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout
        searchTimeoutRef.current = setTimeout(() => {
            searchPlayers(value);
        }, 300);
    };

    // Handle player selection
    const selectPlayer = (player: PlayerSearchResult) => {
        setSelectedExistingPlayer(player);
        setPlayerName(player.Name);
        setShowDropdown(false);
        setIsNewPlayer(false);
    };

    // Reset states when switching between new/existing player
    const resetStates = () => {
        setSelectedExistingPlayer(null);
        setError('');
        setSearchResults([]);
        setShowDropdown(false);
    };

    // Handle clicking outside dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('.dropdown-container')) {
                setShowDropdown(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Check if check-in is enabled
    const isCheckInEnabled = () => {
        const hasName = playerName.trim().length > 0;
        return hasName && (isNewPlayer === true || selectedExistingPlayer !== null);
    };

    // Get check-in button text
    const getCheckInButtonText = () => {
        if (!playerName.trim()) return 'Enter player name';
        if (isNewPlayer === null) return 'Choose new or existing player';
        if (isNewPlayer === false && !selectedExistingPlayer) return 'Select player from dropdown';
        return `Check in ${isNewPlayer ? '(new player)' : '(existing player)'}`;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isCheckInEnabled() || submitting) return;

        setSubmitting(true);
        setError('');

        try {
            let response;

            if (isNewPlayer) {
                // Check in as new player - POST with force_new_player flag
                response = await fetch(`/api/checkin/${token}/players`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        player_name: playerName.trim(),
                        force_new_player: true
                    })
                });
            } else if (selectedExistingPlayer) {
                // Check in as existing player - PUT with selected player info
                response = await fetch(`/api/checkin/${token}/players`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        selected_player_uid: selectedExistingPlayer.UID,
                        entered_name: selectedExistingPlayer.Name
                    })
                });
            } else {
                throw new Error('Invalid check-in state');
            }

            const data: CheckInResponse = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Check-in failed');
            }

            setSuccess(data.message || 'Successfully checked in!');
            setStep('success');

            // Call success callback after a short delay to show success message
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);

        } catch (error) {
            console.error('Check-in error:', error);
            setError(error instanceof Error ? error.message : 'Check-in failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-900">Check In</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 'enter_name' && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Player Name Input */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-900">
                                    Player Name
                                </label>
                                <div className="relative dropdown-container">
                                    <input
                                        type="text"
                                        value={playerName}
                                        onChange={(e) => handleSearchInput(e.target.value)}
                                        onFocus={() => {
                                            if (searchResults.length > 0) setShowDropdown(true);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                        placeholder="Enter your name"
                                        autoComplete="off"
                                    />

                                    {isSearching && (
                                        <div className="absolute right-3 top-2.5">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                        </div>
                                    )}

                                    {/* Search Results Dropdown */}
                                    {showDropdown && searchResults.length > 0 && (
                                        <PlayerSearchDropdown
                                            searchResults={searchResults}
                                            isSearching={isSearching}
                                            checkedInPlayers={checkedInPlayers}
                                            onSelectPlayer={selectPlayer}
                                            showAddNewOption={false}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* New vs Existing Player Selection */}
                            {playerName.trim() && (
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsNewPlayer(true);
                                                resetStates();
                                            }}
                                            className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${isNewPlayer === true
                                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            New Player
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsNewPlayer(false);
                                                resetStates();
                                                if (searchResults.length === 0 && playerName.trim()) {
                                                    searchPlayers(playerName);
                                                } else {
                                                    setShowDropdown(searchResults.length > 0);
                                                }
                                            }}
                                            className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${isNewPlayer === false
                                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            Existing Player
                                        </button>
                                    </div>

                                    {/* Helper text */}
                                    {isNewPlayer === false && !selectedExistingPlayer && playerName.trim() && (
                                        <p className="text-sm text-amber-600 mt-2">
                                            Please select your name from the dropdown above
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Error Display */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-700 text-sm">{error}</p>
                                </div>
                            )}

                            {/* Check-In Button */}
                            <button
                                type="submit"
                                disabled={!isCheckInEnabled() || submitting}
                                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${isCheckInEnabled() && !submitting
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {submitting ? 'Checking in...' : getCheckInButtonText()}
                            </button>
                        </form>
                    )}

                    {step === 'success' && (
                        <div className="text-center">
                            <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Successfully Checked In!
                            </h3>
                            <p className="text-gray-600 mb-6">{success}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}