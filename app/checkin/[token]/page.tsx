// app/checkin/[token]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, Users, User, Check, AlertCircle } from 'lucide-react';

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

    // Player search functionality
    useEffect(() => {
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
        setPlayerName(player.nickname || player.Name);
        setShowDropdown(false);


    };

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

            // --- CHANGED: Accept error from type: "error" responses (even if status 200) ---
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
            <div className="max-w-md mx-auto">
                {/* Tournament Info Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-center text-xl font-bold text-black">
                            Tournament Check-In
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {tournament && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-5 w-5 text-blue-600" />
                                    <span className="font-medium text-black">{formatDate(tournament.tournament_date)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="h-5 w-5 text-blue-600" />
                                    <span className="text-black">{tournament.venue}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <User className="h-5 w-5 text-blue-600" />
                                    <span className="text-black">Director: {tournament.director_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Users className="h-5 w-5 text-blue-600" />
                                    <span className="text-black">{tournament.player_count} players registered</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

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
                                            onChange={(e) => setPlayerName(e.target.value)}
                                            onFocus={() => {
                                                if (playerName.length >= 2) {
                                                    setShowDropdown(true);
                                                }
                                            }}
                                            onBlur={() => {
                                                // Small delay to allow dropdown clicks to register
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
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                            <p className="text-red-700 text-sm">{error}</p>
                                        </div>
                                    )}

                                    <button
                                        id="checkin-button"
                                        type="submit"
                                        disabled={submitting || !playerName.trim()}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors mt-10"
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
                                <p className="text-black mb-4">{success}</p>
                                <p className="text-sm text-black">
                                    You're all set! Good luck in the tournament.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}