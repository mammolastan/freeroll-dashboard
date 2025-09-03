'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, Users, User, Check, AlertCircle, RefreshCw, Skull, QrCode } from 'lucide-react';
import { formatGameDateET } from '@/lib/utils';
import { QRCodeModal } from "@/app/admin/tournament-entry/QRCodeModal";

interface Tournament {
    id: number;
    tournament_date: string;
    director_name: string;
    venue: string;
    start_points: number;
    player_count: number;
}

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

interface Player {
    Name: string;
    UID: string;
    nickname: string | null;
    TotalGames?: number;
}

interface CheckedInPlayer {
    id: number;
    player_name: string;
    player_nickname: string;
    player_uid: string | null;
    is_new_player: boolean;
    added_by: string;
    checked_in_at: string;
    hitman_name: string | null;
    ko_position: number | null;
}

export default function CheckInPage({ params }: { params: { token: string } }) {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [playerName, setPlayerName] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [step, setStep] = useState<'enter_name' | 'success'>('enter_name');

    // New player selection state
    const [isNewPlayer, setIsNewPlayer] = useState<boolean | null>(null);
    const [selectedExistingPlayer, setSelectedExistingPlayer] = useState<Player | null>(null);

    // Player search dropdown states
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Checked-in players list
    const [checkedInPlayers, setCheckedInPlayers] = useState<CheckedInPlayer[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // QR Code Modal states
    const [checkInUrl, setCheckInUrl] = useState<string>('');
    const [showQRCode, setShowQRCode] = useState(false);
    const [currentDraft, setCurrentDraft] = useState<{ tournament_date: string; venue: string }>({ tournament_date: '', venue: '' });

    // Use ref to track debounce timeout
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load tournament info
    useEffect(() => {
        const loadTournament = async () => {
            try {
                const response = await fetch(`/api/checkin/${params.token}`);
                if (response.ok) {
                    const data = await response.json();
                    setTournament(data);
                } else {
                    const errorData = await response.json();
                    setError(errorData.error || 'Tournament not found');
                }
            } catch (error) {
                console.error('Error loading tournament:', error);
                setError('Failed to load tournament');
            } finally {
                setLoading(false);
            }
        };

        loadTournament();
    }, [params.token]);

    // Load checked-in players when tournament loads
    useEffect(() => {
        if (tournament) {
            loadCheckedInPlayers();
        }

        setCurrentDraft(
            {
                tournament_date: tournament?.tournament_date || '',
                venue: tournament?.venue || ''
            });
        setCheckInUrl(`${window.location.origin}/checkin/${params.token}`);
    }, [tournament]);

    const loadCheckedInPlayers = async () => {
        setLoadingPlayers(true);
        try {
            const response = await fetch(`/api/checkin/${params.token}/players`);
            if (response.ok) {
                const data = await response.json();
                setCheckedInPlayers(data);
            } else {
                console.error('Failed to load checked-in players');
            }
        } catch (error) {
            console.error('Error loading checked-in players:', error);
        } finally {
            setLoadingPlayers(false);
        }
    };

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
    const selectPlayer = (player: Player) => {
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

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                // Check in as new player
                response = await fetch(`/api/checkin/${params.token}/players`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        player_name: playerName.trim(),
                        force_new_player: true
                    })
                });
            } else if (selectedExistingPlayer) {
                // Check in as existing player
                response = await fetch(`/api/checkin/${params.token}/players`, {
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
            // Refresh the checked-in players list
            loadCheckedInPlayers();

        } catch (error) {
            console.error('Check-in error:', error);
            setError(error instanceof Error ? error.message : 'Check-in failed');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate tournament stats
    const getTournamentStats = () => {
        const totalRegistered = checkedInPlayers.length;
        const knockedOut = checkedInPlayers.filter(player => player.ko_position !== null).length;
        const remaining = totalRegistered - knockedOut;


        return { totalRegistered, knockedOut, remaining };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading tournament...</p>
                </div>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
                <Card className="w-full max-w-md mx-4">
                    <CardContent className="pt-6 text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-black mb-2">Tournament Not Found</h2>
                        <p className="text-gray-600">{error || 'This check-in link is invalid or expired.'}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { totalRegistered, knockedOut, remaining } = getTournamentStats();

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-8">
            <div className="max-w-2xl mx-auto px-4 space-y-6">
                {/* Tournament Info Header */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold text-black mb-2">Tournament Info</h1>
                            <div className="space-y-2 text-gray-600">
                                <div className="flex items-center justify-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>{formatGameDateET(tournament.tournament_date)}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span>{tournament.venue}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>Director: {tournament.director_name}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setShowQRCode(true)}
                                        className="flex items-center gap-2  px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <QrCode className="h-4 w-4" /> Share

                                    </button>
                                </div>
                                {showQRCode && (
                                    <QRCodeModal checkInUrl={checkInUrl} showQRCode={showQRCode} setShowQRCode={setShowQRCode} currentDraft={currentDraft} />
                                )}
                                {/* Tournament Stats */}
                                <div className="flex items-center justify-center gap-4 mt-4 text-sm font-medium">
                                    <div className="text-blue-600">
                                        {totalRegistered} players registered
                                    </div>
                                    {totalRegistered > 0 && (
                                        <>
                                            <span className="text-gray-400">|</span>
                                            <div className="text-green-600">
                                                {remaining} players remaining
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Check-in Form */}
                        {step === 'enter_name' && (
                            <div>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Player Name Input */}
                                    <div className="space-y-2">
                                        <h2 className='text-black'>Check-in</h2>
                                        <label className="block text-sm font-medium text-black">
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
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
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
                                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                    {searchResults.map((player) => (
                                                        <button
                                                            key={player.UID}
                                                            type="button"
                                                            onClick={() => selectPlayer(player)}
                                                            className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 text-black"
                                                        >
                                                            <div className="font-medium">{player.Name}</div>
                                                            {player.nickname && (
                                                                <div className="text-sm text-gray-500">"{player.nickname}"</div>
                                                            )}
                                                            {player.TotalGames && (
                                                                <div className="text-xs text-gray-400">{player.TotalGames > 100 ? '+100' : player.TotalGames} games played</div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}


                                        </div>
                                    </div>

                                    {/* New vs Existing Player Selection */}
                                    {playerName.trim() && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-600">Is this you?</p>
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
                            </div>
                        )}

                        {step === 'success' && (
                            <div className="text-center">
                                <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-black mb-2">
                                    Successfully Checked In!
                                </h3>
                                <p className="text-black mb-6">{success}</p>


                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Checked-in Players List */}
                {checkedInPlayers.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-black text-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    {totalRegistered} Players  | <span className="text-green-600">{remaining} remaining</span>
                                </div>
                                <button
                                    onClick={loadCheckedInPlayers}
                                    disabled={loadingPlayers}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                    title="Refresh player list"
                                >
                                    <RefreshCw className={`h-4 w-4 text-gray-600 ${loadingPlayers ? 'animate-spin' : ''}`} />
                                </button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingPlayers ? (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {checkedInPlayers.map((player, index) => {
                                        const isKnockedOut = player.ko_position !== null;

                                        return (
                                            <div
                                                key={player.id}
                                                className={`flex items-center justify-between p-3 rounded-lg ${isKnockedOut ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                                                    }`}
                                            >
                                                <div className="font-medium text-black flex items-center gap-2">
                                                    <span className={isKnockedOut ? 'line-through text-red-600' : ''}>
                                                        {player.player_nickname || player.player_name}
                                                    </span>

                                                    {/* Knockout info */}
                                                    {isKnockedOut && player.hitman_name && player.hitman_name !== 'unknown' && (
                                                        <div className="flex items-center gap-1 text-red-600 text-sm">
                                                            🥊
                                                            <span>{player.hitman_name}</span>
                                                        </div>
                                                    )}


                                                    {player.is_new_player ? (
                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">New</span>
                                                    ) : ''}
                                                </div>

                                                <div className="text-xs text-gray-500">
                                                    {new Date(player.checked_in_at).toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit'
                                                    }).replace(/\s?(AM|PM)/i, '')}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}