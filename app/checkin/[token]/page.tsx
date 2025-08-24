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
    const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([]);
    const [enteredName, setEnteredName] = useState('');
    const [step, setStep] = useState<'enter_name' | 'choose_player' | 'success'>('enter_name');

    // Player search dropdown states
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Checked-in players list
    const [checkedInPlayers, setCheckedInPlayers] = useState<CheckedInPlayer[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // Use ref to track user selection to prevent dropdown reopening
    const userSelectedPlayer = useRef(false);

    // Player search functionality
    useEffect(() => {
        // If user just selected a player, don't trigger search
        if (userSelectedPlayer.current) {
            userSelectedPlayer.current = false;
            return;
        }

        if (!playerName || playerName.length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`/api/players/search?q=${encodeURIComponent(playerName)}&name=true`);
                const data = await response.json();
                setSearchResults(data || []);
                setShowDropdown(true);
            } catch (error) {
                console.error('Failed to fetch players:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [playerName]);

    const handlePlayerSelect = (player: Player) => {
        userSelectedPlayer.current = true;
        setPlayerName(player.nickname || player.Name);
        setShowDropdown(false);
    };

    // Load checked-in players
    const loadCheckedInPlayers = async () => {
        if (!tournament) return;

        setLoadingPlayers(true);
        try {
            const response = await fetch(`/api/checkin/${params.token}/players`);
            if (response.ok) {
                const data = await response.json();
                setCheckedInPlayers(data);
            }
        } catch (error) {
            console.error('Failed to load checked-in players:', error);
        } finally {
            setLoadingPlayers(false);
        }
    };

    // Load checked-in players when tournament loads or after successful check-in
    useEffect(() => {
        if (tournament) {
            loadCheckedInPlayers();
        }
    }, [tournament]);

    const handleDirectCheckIn = async (selectedPlayer: Player) => {
        setSubmitting(true);
        setError('');

        try {
            const response = await fetch(`/api/checkin/${params.token}/players`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selected_player_uid: selectedPlayer.UID,
                    entered_name: selectedPlayer.Name
                })
            });

            const data: CheckInResponse = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Check-in failed');
            }

            setSuccess(data.message || 'Successfully checked in!');
            setStep('success');

            // Refresh the checked-in players list
            loadCheckedInPlayers();

        } catch (error) {
            console.error('Direct check-in error:', error);
            setError(error instanceof Error ? error.message : 'Check-in failed');
        } finally {
            setSubmitting(false);
        }
    };

    // Load tournament info
    useEffect(() => {
        const loadTournament = async () => {
            try {
                const response = await fetch(`/api/checkin/${params.token}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Tournament not found');
                }
                const tournamentData = await response.json();
                setTournament(tournamentData);
            } catch (error) {
                console.error('Error loading tournament:', error);
                setError(error instanceof Error ? error.message : 'Failed to load tournament');
            } finally {
                setLoading(false);
            }
        };

        loadTournament();
    }, [params.token]);

    const handleNameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim()) return;

        setShowDropdown(false);
        setSubmitting(true);
        setError('');

        try {
            const response = await fetch(`/api/checkin/${params.token}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_name: playerName.trim() })
            });

            const data: CheckInResponse = await response.json();

            if (data.type === 'error') {
                setError(data.error || 'Check-in failed');
                return;
            }

            if (!response.ok) {
                throw new Error(data.message || 'Check-in failed');
            }

            if (data.type === 'suggestions') {
                setSuggestions(data.suggestions || []);
                setEnteredName(data.entered_name || playerName.trim());
                setStep('choose_player');
            } else if (data.type === 'success') {
                setSuccess(data.message || 'Successfully checked in!');
                setStep('success');
                // Refresh the checked-in players list
                loadCheckedInPlayers();
            }

        } catch (error) {
            console.error('Check-in error:', error);
            setError(error instanceof Error ? error.message : 'Check-in failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePlayerSelection = async (selectedUid: string) => {
        setSubmitting(true);
        setError('');

        try {
            const response = await fetch(`/api/checkin/${params.token}/players`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selected_player_uid: selectedUid,
                    entered_name: enteredName
                })
            });

            const data: CheckInResponse = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Check-in failed');
            }

            setSuccess(data.message || 'Successfully checked in!');
            setStep('success');

            // Refresh the checked-in players list
            loadCheckedInPlayers();

        } catch (error) {
            console.error('Player selection error:', error);
            setError(error instanceof Error ? error.message : 'Check-in failed');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatCheckInTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-black">Loading tournament...</p>
                </div>
            </div>
        );
    }

    if (error && !tournament) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Card className="w-full max-w-md mx-4">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-black mb-2">Tournament Not Found</h2>
                            <p className="text-black mb-4">{error}</p>
                            <p className="text-sm text-black">
                                Please check your QR code or contact the tournament director.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Tournament Info Card */}
                {tournament && (
                    <Card>
                        <CardHeader className="bg-blue-600 text-white">
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Tournament Check-In
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-blue-600" />
                                    <span className="text-black">{formatDate(tournament.tournament_date)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-blue-600" />
                                    <span className="text-black">{tournament.venue}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    <span className="text-black">Director: {tournament.director_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-blue-600" />
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
                                <h3 className="text-lg font-semibold text-black mb-4 text-center">
                                    Enter Your Name
                                </h3>
                                <form onSubmit={handleNameSubmit} className="">
                                    <div className="relative mb-10">
                                        <input
                                            type="text"
                                            value={playerName}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setPlayerName(value);
                                                userSelectedPlayer.current = false; // Reset flag when user types manually
                                            }}
                                            onFocus={() => {
                                                if (playerName.length >= 2) {
                                                    setShowDropdown(true);
                                                }
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => setShowDropdown(false), 150);
                                            }}
                                            placeholder="Your full name"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                            disabled={submitting}
                                            autoFocus
                                        />

                                        {/* Player Search Dropdown */}
                                        {showDropdown && searchResults.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                {isSearching && (
                                                    <div className="px-4 py-2 text-black text-sm">
                                                        Searching...
                                                    </div>
                                                )}
                                                {searchResults.map((player) => (
                                                    <div
                                                        key={player.UID}
                                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                                        onClick={() => handlePlayerSelect(player)}
                                                    >
                                                        <div className="font-medium text-black">
                                                            {player.nickname || player.Name}
                                                        </div>
                                                        {player.TotalGames && (
                                                            <div className="text-sm text-black">
                                                                {player.TotalGames > 100 ? '+100' : player.TotalGames} games played
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                                            <p className="text-red-700 text-sm">{error}</p>
                                        </div>
                                    )}

                                    <button
                                        id="checkin-button"
                                        type="submit"
                                        disabled={submitting || !playerName.trim()}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                                    >
                                        {submitting ? 'Checking in...' : 'Check In'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {step === 'choose_player' && (
                            <div>
                                <h3 className="text-lg font-semibold text-black mb-2 text-center">
                                    Is this you?
                                </h3>
                                <p className="text-black text-center mb-4">
                                    We found similar names. Please select the correct one:
                                </p>

                                <div className="space-y-3">
                                    {suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion.uid}
                                            onClick={() => handlePlayerSelection(suggestion.uid)}
                                            disabled={submitting}
                                            className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                                        >
                                            <div className="font-medium text-black">{suggestion.name}</div>
                                            {suggestion.nickname && (
                                                <div className="text-sm text-black">"{suggestion.nickname}"</div>
                                            )}
                                        </button>
                                    ))}

                                    <button
                                        onClick={() => handlePlayerSelection('new_player')}
                                        disabled={submitting}
                                        className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors disabled:opacity-50"
                                    >
                                        <div className="font-medium text-green-700">
                                            Register as new player: "{enteredName}"
                                        </div>
                                        <div className="text-sm text-green-600">
                                            Choose this if none of the above are you
                                        </div>
                                    </button>
                                </div>

                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-red-700 text-sm">{error}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'success' && (
                            <div className="text-center">
                                <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-black mb-2">
                                    Successfully Checked In!
                                </h3>
                                <p className="text-green-600 mb-4">{success}</p>
                                <p className="text-black text-sm">
                                    You're all set for the tournament. Good luck!
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Checked-In Players List */}
                {tournament && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Registered Players ({checkedInPlayers.length})
                                </span>
                                <button
                                    onClick={loadCheckedInPlayers}
                                    disabled={loadingPlayers}
                                    className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                >
                                    {loadingPlayers ? 'Refreshing...' : 'Refresh'}
                                </button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingPlayers ? (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                    <p className="text-gray-600 text-sm">Loading players...</p>
                                </div>
                            ) : checkedInPlayers.length === 0 ? (
                                <p className="text-gray-600 text-center py-4">No players have checked in yet.</p>
                            ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {checkedInPlayers.map((player, index) => (
                                        <div
                                            key={player.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">

                                                <div>
                                                    <div className="font-medium text-black flex items-center gap-2">
                                                        {player.player_name}

                                                        {!!player.is_new_player && (
                                                            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                                                                New
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {formatGameDateET(player.checked_in_at, "short")}
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