// app/checkin/[token]/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, Users, User, Check, AlertCircle } from 'lucide-react';
import { formatGameDateET } from '@/lib/utils';

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
    player_uid: string | null;
    is_new_player: boolean;
    added_by: string;
    checked_in_at: string;
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

    // Use ref to track user selection to prevent dropdown reopening
    const userSelectedPlayer = useRef(false);

    // Search for players as user types
    const searchPlayers = async (searchTerm: string) => {


        if (searchTerm.length < 2 || userSelectedPlayer.current) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(`/api/players/search?q=${encodeURIComponent(searchTerm)}&name=true&limit=5`);
            if (response.ok) {
                const players = await response.json();

                setSearchResults(players);
                if (!userSelectedPlayer.current && searchTerm.length >= 1 && players.length > 0) {

                    setShowDropdown(true);
                } else if (players.length === 0) {

                    setShowDropdown(false);
                }
            }
        } catch (error) {
            console.error('Player search error:', error);
            setSearchResults([]);
            setShowDropdown(false);
        } finally {
            setIsSearching(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (playerName.length >= 1) {
                searchPlayers(playerName);
            } else {
                setSearchResults([]);
                setShowDropdown(false);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [playerName]);

    const loadCheckedInPlayers = async () => {
        try {
            setLoadingPlayers(true);
            const response = await fetch(`/api/checkin/${params.token}/players`);
            if (response.ok) {
                const players = await response.json();
                setCheckedInPlayers(players);
            }
        } catch (error) {
            console.error('Error loading checked-in players:', error);
        } finally {
            setLoadingPlayers(false);
        }
    };

    useEffect(() => {
        const loadTournament = async () => {
            try {
                const response = await fetch(`/api/checkin/${params.token}`);
                const data = await response.json();

                if (response.ok) {
                    setTournament(data);
                    await loadCheckedInPlayers();
                } else {
                    setError(data.error || 'Failed to load tournament');
                }
            } catch (error) {
                console.error('Error loading tournament:', error);
                setError(error instanceof Error ? error.message : 'Failed to load tournament');
            } finally {
                setLoading(false);
            }
        };

        loadTournament();
    }, [params.token]);

    // Handle selecting a player from dropdown
    const handlePlayerSelect = (player: Player) => {
        setPlayerName(player.Name);
        setSelectedExistingPlayer(player);
        setIsNewPlayer(false); // Auto-select "No" when existing player is selected
        setShowDropdown(false);
        userSelectedPlayer.current = true;
    };

    // Handle new player radio button change
    const handleNewPlayerChange = (newPlayerValue: boolean) => {
        setIsNewPlayer(newPlayerValue);
        if (newPlayerValue) {
            // If selecting "Yes, I'm a new player", clear any selected existing player
            setSelectedExistingPlayer(null);
        }
    };

    // Handle name input change
    const handleNameChange = (value: string) => {
        setPlayerName(value);
        userSelectedPlayer.current = false; // Reset flag when user types manually

        // If user starts typing after selecting an existing player, clear the selection
        if (selectedExistingPlayer && value !== selectedExistingPlayer.Name) {
            setSelectedExistingPlayer(null);
            setIsNewPlayer(null); // Reset new player selection
        }

        // Show dropdown if typing and we have results
        if (value.length >= 1 && searchResults.length > 0 && !userSelectedPlayer.current) {
            setShowDropdown(true);
        }
    };

    // Check if check-in button should be enabled
    const isCheckInEnabled = () => {
        if (!playerName.trim()) return false;

        if (isNewPlayer === true) {
            // New player: just need a name typed in
            return playerName.trim().length > 0;
        } else if (isNewPlayer === false) {
            // Existing player: need to have selected from dropdown
            return selectedExistingPlayer !== null;
        }

        return false; // Neither option selected
    };

    // Get the display name for the check-in button
    const getCheckInButtonText = () => {
        if (!playerName.trim()) return 'Check In';

        if (isNewPlayer === true) {
            return `Check-in as ${playerName.trim()}`;
        } else if (selectedExistingPlayer) {
            return `Check-in as ${selectedExistingPlayer.Name}`;
        }

        return 'Check In';
    };

    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isCheckInEnabled()) return;

        setShowDropdown(false);
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

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-8 px-4">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Tournament Info Card */}
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-black text-2xl">Tournament Check-In</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                <span className="text-black font-medium">
                                    {formatGameDateET(tournament.tournament_date)}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-blue-600" />
                                <span className="text-black">{tournament.venue}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-blue-600" />
                                <span className="text-black">Director: {tournament.director_name}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Checked-in Players Count */}
                {checkedInPlayers.length > 0 && (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <Users className="h-5 w-5 text-blue-600" />
                                    <span className="text-black">{checkedInPlayers.length} players registered</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Main Check-In Card */}
                <Card>
                    <CardContent className="pt-6">
                        {step === 'enter_name' && (
                            <div>
                                <h3 className="text-lg font-semibold text-black mb-6 text-center">
                                    Player Check-In
                                </h3>

                                <form onSubmit={handleCheckIn}>
                                    {/* Name Input with Dropdown */}
                                    <div className="relative mb-6">
                                        <label className="block text-sm font-medium text-black mb-2">
                                            Your Name
                                        </label>
                                        <input
                                            type="text"
                                            value={playerName}
                                            onChange={(e) => handleNameChange(e.target.value)}
                                            onFocus={() => {
                                                if (playerName.length >= 1 && searchResults.length > 0 && !selectedExistingPlayer) {
                                                    setShowDropdown(true);
                                                }
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => setShowDropdown(false), 150);
                                            }}
                                            placeholder="Enter your full name"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                                            disabled={submitting}
                                        />

                                        {/* Search Results Dropdown */}
                                        {showDropdown && searchResults.length > 0 && !selectedExistingPlayer && !userSelectedPlayer.current && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                {searchResults.map((player) => (
                                                    <button
                                                        key={player.UID}
                                                        type="button"
                                                        onClick={() => handlePlayerSelect(player)}
                                                        className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 focus:bg-blue-50 focus:outline-none"
                                                    >
                                                        <div className="font-medium text-black">{player.Name}</div>
                                                        {player.nickname && (
                                                            <div className="text-sm text-gray-600">"{player.nickname}"</div>
                                                        )}
                                                        {player.TotalGames && (
                                                            <div className="text-xs text-gray-500">{player.TotalGames > 100 ? '+100' : player.TotalGames} games played</div>
                                                        )}

                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* New Player Selection */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-black mb-3">
                                            Are you new to this league?
                                        </label>
                                        <div className="space-y-2">
                                            <div className="flex items-center">
                                                <input
                                                    type="radio"
                                                    id="existing-player"
                                                    name="newPlayer"
                                                    checked={isNewPlayer === false}
                                                    onChange={() => handleNewPlayerChange(false)}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    disabled={submitting}
                                                />
                                                <label htmlFor="existing-player" className="ml-2 text-black">
                                                    No
                                                    {selectedExistingPlayer && (
                                                        <span className="text-green-600 font-medium"> ✓ ({selectedExistingPlayer.Name})</span>
                                                    )}
                                                </label>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="radio"
                                                    id="new-player"
                                                    name="newPlayer"
                                                    checked={isNewPlayer === true}
                                                    onChange={() => handleNewPlayerChange(true)}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    disabled={submitting}
                                                />
                                                <label htmlFor="new-player" className="ml-2 text-black">
                                                    Yes, I am new to this league
                                                </label>
                                            </div>
                                        </div>

                                        {/* Helper text */}
                                        {isNewPlayer === false && !selectedExistingPlayer && playerName.trim() && (
                                            <p className="text-sm text-amber-600 mt-2">
                                                Please select your name from the dropdown above
                                            </p>
                                        )}
                                    </div>

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

                                <button
                                    onClick={() => {
                                        setStep('enter_name');
                                        setPlayerName('');
                                        setIsNewPlayer(null);
                                        setSelectedExistingPlayer(null);
                                        setSuccess('');
                                        setError('');
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    Check In Another Player
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Checked-in Players List */}
                {step !== 'success' && checkedInPlayers.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-black text-lg flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Registered Players ({checkedInPlayers.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingPlayers ? (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {checkedInPlayers.map((player, index) => (
                                        <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">



                                            <div className="font-medium text-black flex items-center gap-2">
                                                {player.player_name}
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
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}