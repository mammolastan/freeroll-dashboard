// app/check-in/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, Trophy, Clock, ArrowRight } from 'lucide-react';
import { formatGameDate, formatTime } from '@/lib/utils';

interface ActiveTournament {
    id: number;
    tournament_date: string;
    tournament_time?: string;
    director_name: string;
    venue: string;
    start_points: number;
    status: string;
    blind_schedule: string;
    timer_current_level: number | null;
    timer_is_running: boolean;
    timer_is_paused: boolean;
    total_players: number;
    players_remaining: number;
    created_at: string;
    updated_at: string;
}

export default function CheckInPage() {
    const [tournaments, setTournaments] = useState<ActiveTournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchActiveTournaments();
    }, []);

    const fetchActiveTournaments = async () => {
        try {
            const response = await fetch('/api/tournaments/active');

            if (!response.ok) {
                throw new Error('Failed to fetch active tournaments');
            }

            const data = await response.json();
            setTournaments(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching tournaments:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const getBlindLevelDisplay = (level: number | null, schedule: string, isRunning: boolean, isPaused: boolean) => {
        // If timer has never been started (not running and not paused), show "Not started"
        if (!isRunning && !isPaused) return 'Not started';

        // If timer has been started, show the level
        if (!level) return 'Not started';
        return `Level ${level} (${schedule === 'turbo' ? 'Turbo' : 'Standard'})`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto shadow-[0_0_20px_rgba(6,182,212,0.5)]"></div>
                    <p className="mt-4 text-cyan-300">Loading active tournaments...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] mb-2">
                        Active Tournaments
                    </h1>
                    <p className="text-gray-400">
                        Select a tournament to view live standings and check in
                    </p>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
                        <p className="font-semibold">Error loading tournaments</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* No Tournaments State */}
                {!loading && tournaments.length === 0 && !error && (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-2xl font-semibold text-gray-300 mb-2">
                            No Active Tournaments
                        </h2>
                        <p className="text-gray-500">
                            There are currently no tournaments in progress.
                        </p>
                    </div>
                )}

                {/* Tournaments Grid */}
                {tournaments.length > 0 && (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tournaments.map((tournament) => (
                            <Link
                                key={tournament.id}
                                href={`/gameview/${tournament.id}`}
                                className="block transition-transform hover:scale-105"
                            >
                                <div className="h-full bg-gray-900/80 border border-cyan-500/30 rounded-lg hover:border-cyan-500/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all backdrop-blur-sm overflow-hidden">
                                    {/* Header */}
                                    <div className="border-b border-cyan-500/20 p-6 pb-4">
                                        <div className="text-xl font-semibold text-cyan-300 flex items-center justify-between">
                                            <span className="truncate">{tournament.venue}</span>
                                            <ArrowRight className="h-5 w-5 flex-shrink-0 ml-2" />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-6 pt-4 space-y-3">
                                        {/* Date */}
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <Calendar className="h-4 w-4 text-cyan-400" />
                                            <span className="text-sm">
                                                {formatGameDate(tournament.tournament_date)}
                                                {formatTime(tournament.tournament_time) && (
                                                    <span className="ml-2 text-cyan-300 font-semibold">
                                                        @ {formatTime(tournament.tournament_time)}
                                                    </span>
                                                )}
                                            </span>
                                        </div>

                                        {/* Venue */}
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <MapPin className="h-4 w-4 text-cyan-400" />
                                            <span className="text-sm truncate">{tournament.venue}</span>
                                        </div>

                                        {/* Player Stats */}
                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                            <div className="bg-cyan-900/20 rounded-lg p-2 border border-cyan-500/20">
                                                <div className="flex items-center gap-1 text-cyan-400 mb-1">
                                                    <Users className="h-3 w-3" />
                                                    <span className="text-xs">Checked In</span>
                                                </div>
                                                <div className="text-xl font-bold text-cyan-300">
                                                    {tournament.total_players}
                                                </div>
                                            </div>

                                            <div className="bg-green-900/20 rounded-lg p-2 border border-green-500/20">
                                                <div className="flex items-center gap-1 text-green-400 mb-1">
                                                    <Trophy className="h-3 w-3" />
                                                    <span className="text-xs">Remaining</span>
                                                </div>
                                                <div className="text-xl font-bold text-green-300">
                                                    {tournament.players_remaining}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Blind Level */}
                                        <div className="flex items-center gap-2 text-gray-300 pt-2 border-t border-gray-700/50">
                                            <Clock className="h-4 w-4 text-purple-400" />
                                            <span className="text-sm">
                                                {getBlindLevelDisplay(
                                                    tournament.timer_current_level,
                                                    tournament.blind_schedule,
                                                    tournament.timer_is_running,
                                                    tournament.timer_is_paused
                                                )}
                                            </span>
                                        </div>

                                        {/* Director */}
                                        {tournament.director_name && (
                                            <div className="text-xs text-gray-500 pt-1">
                                                TD: {tournament.director_name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}