// components/PlayerDashboard/PlayerDetails.tsx

import { useState, useEffect } from 'react';
import { DateRangeSelector } from './DateRangeSelector';
import Link from 'next/link';
import RotatingImageLoader from '../ui/RotatingImageLoader';
import { PlacementFrequencyChart } from './PlacementFrequencyChart'
import { DateRangePicker } from './DateRangePicker';
import { formatGameDate, formatDateRangeText } from '@/lib/utils';

interface PlacementFrequencyData {
    placement: number;
    frequency: number;
}

interface PlayerStats {
    quarterlyStats: {
        gamesPlayed: number;
        totalPoints: number;
        knockouts: number;
        finalTables: number;
        avgScore: number;
        leagueRanking?: number | null;
        totalPlayers?: number | null;
    };
    placementFrequency: PlacementFrequencyData[];
    mostKnockedOutBy: Array<{
        name: string;
        count: number;
    }>;
    mostKnockedOut: Array<{
        name: string;
        count: number;
    }>;
    venueStats: Array<{
        venue: string;
        points: number;
    }>;
    recentGames: Array<{
        date: string;
        venue: string;
        placement: number;
        points: number;
        knockouts: number;
        fileName: string;
    }>;
    earliestGameDate: string | null;
}
interface PlayerDetailsProps {
    playerUID: string;
    playerName: string;
    initialRange?: string | null;
    onRangeChange?: (range: string) => void;
}



export function PlayerDetails({ playerUID, playerName, initialRange }: PlayerDetailsProps) {
    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState(() => {
        if (initialRange) {
            return initialRange;
        }
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
        return `Q${currentQuarter}-${currentYear}`;
    });

    // State for dates
    const [startDate, setStartDate] = useState<Date | null>(() => {
        if (initialRange === 'all-time') return null;

        const currentDate = new Date();
        if (initialRange === 'current-month') {
            return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        }

        if (initialRange?.includes('Q')) {
            const [quarter, year] = initialRange.split('-');
            const quarterNum = parseInt(quarter.slice(1));
            const yearNum = parseInt(year);
            return new Date(yearNum, (quarterNum - 1) * 3, 1);
        }

        // Default to current quarter
        const currentQuarter = Math.floor(currentDate.getMonth() / 3);
        return new Date(currentDate.getFullYear(), currentQuarter * 3, 1);
    });

    const [endDate, setEndDate] = useState<Date | null>(() => {
        if (initialRange === 'all-time') return null;

        const currentDate = new Date();
        if (initialRange === 'current-month') {
            return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        }

        if (initialRange?.includes('Q')) {
            const [quarter, year] = initialRange.split('-');
            const quarterNum = parseInt(quarter.slice(1));
            const yearNum = parseInt(year);
            return new Date(yearNum, quarterNum * 3, 0);
        }

        // Default to current quarter
        const currentQuarter = Math.floor(currentDate.getMonth() / 3);
        return new Date(currentDate.getFullYear(), (currentQuarter + 1) * 3, 0);
    });

    // Custom date range state
    const [isCustomRange, setIsCustomRange] = useState(false);
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

    const fetchPlayerStats = async (customStart?: Date, customEnd?: Date) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            if (isCustomRange && customStart && customEnd) {
                params.append('startDate', customStart.toISOString());
                params.append('endDate', customEnd.toISOString());
            } else if (startDate) {
                params.append('startDate', startDate.toISOString());
                if (endDate) {
                    params.append('endDate', endDate.toISOString());
                }
            }

            const response = await fetch(`/api/players/${playerUID}/stats?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch player stats:', error);
            setStats(null);
        } finally {
            setLoading(false);
        }
    };

    // Handle custom date range changes
    const handleCustomDateRangeChange = (startDate: Date, endDate: Date) => {
        setCustomStartDate(startDate);
        setCustomEndDate(endDate);
        setIsCustomRange(true);
        // Clear the selectedRange when using custom dates
        setSelectedRange('custom');
        fetchPlayerStats(startDate, endDate);
    };

    // Fetch stats when player is selected or date changes
    useEffect(() => {
        if (playerUID) {
            if (!isCustomRange) {
                fetchPlayerStats();
            } else if (customStartDate && customEndDate) {
                fetchPlayerStats(customStartDate, customEndDate);
            }
        }
    }, [playerUID, startDate, endDate, isCustomRange, customStartDate, customEndDate]);

    if (loading) {
        return (
            <div className="text-center py-12 text-gray-600">
                <RotatingImageLoader
                    src="/images/Poker-Chip-Isloated-Blue.png"
                    size="large"
                />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center py-12 text-gray-600">
                No stats available for {playerName}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-white-800">
                    Stats for {playerName}
                </h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCustomRange(false)}
                            className={`px-4 py-2 rounded-lg transition-colors ${!isCustomRange
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600'
                                }`}
                        >
                            Preset Ranges
                        </button>
                        <button
                            onClick={() => setIsCustomRange(true)}
                            className={`px-4 py-2 rounded-lg transition-colors ${isCustomRange
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600'
                                }`}
                        >
                            Custom Range
                        </button>
                    </div>
                    {isCustomRange ? (
                        <DateRangePicker
                            onRangeChange={handleCustomDateRangeChange}
                            initialStartDate={customStartDate}
                            initialEndDate={customEndDate}
                        />
                    ) : (
                        <DateRangeSelector
                            selectedRange={selectedRange}
                            onRangeChange={(newStartDate, newEndDate, newRange) => {
                                setStartDate(newStartDate);
                                setEndDate(newEndDate);
                                setSelectedRange(newRange);
                                localStorage.setItem('selectedRange', newRange);
                            }}
                        />
                    )}
                </div>
            </div>
            <div className="flex flex-col">
                <div className="text-xl font-medium text-white-600">
                    {formatDateRangeText(
                        isCustomRange ? customStartDate : startDate,
                        isCustomRange ? customEndDate : endDate,
                        selectedRange,
                        stats?.earliestGameDate ?? null,
                        isCustomRange
                    )}
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">


                <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="bg-blue-50 p-4 rounded-t-xl border-b border-blue-100">
                        <h3 className="font-bold text-lg text-blue-900">Current time period</h3>
                    </div>
                    <div className="p-4 space-y-3 text-black">
                        {
                            selectedRange.includes('Q') && stats.quarterlyStats.leagueRanking && (
                                <p>Rank: {`${stats.quarterlyStats.leagueRanking}${stats.quarterlyStats.totalPlayers
                                    ? ` of ${stats.quarterlyStats.totalPlayers}`
                                    : ''
                                    }`}
                                </p>
                            )
                        }

                        <StatRow label="Games Played" value={stats.quarterlyStats.gamesPlayed} />
                        <StatRow label="Total Points" value={stats.quarterlyStats.totalPoints} />
                        <StatRow label="Knockouts" value={stats.quarterlyStats.knockouts} />
                        <StatRow label="Final Tables" value={stats.quarterlyStats.finalTables} />
                        <StatRow
                            label="Power Rating"
                            value={typeof stats.quarterlyStats.avgScore === 'number'
                                ? stats.quarterlyStats.avgScore.toFixed(2)
                                : '0.00'}
                        />
                        {selectedRange.includes('Q') && stats.quarterlyStats.leagueRanking && (
                            <StatRow
                                label="League Ranking"
                                value={`${stats.quarterlyStats.leagueRanking}${stats.quarterlyStats.totalPlayers
                                    ? ` of ${stats.quarterlyStats.totalPlayers}`
                                    : ''
                                    }`}
                            />
                        )}
                    </div>
                </div>

                {/* Head to Head Stats */}
                {
                    selectedRange === 'all-time' && (<div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
                        <div className="bg-purple-50 p-4 rounded-t-xl border-b border-purple-100">
                            <h3 className="font-bold text-lg text-purple-900">Head to Head</h3>
                        </div>
                        <div className="p-4 space-y-4">

                            <div>
                                <div className="text-sm font-medium text-purple-900 mb-2">Most knocked out by:</div>
                                <div className="space-y-2">
                                    {stats.mostKnockedOutBy.map((player, index) => (
                                        <div key={player.name} className="flex items-baseline justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-purple-700">{index + 1}.</span>
                                                <Link
                                                    href={`/players?name=${encodeURIComponent(player.name)}&range=${selectedRange}`}
                                                    className="freeroll-link"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        window.location.href = `/players?name=${encodeURIComponent(player.name)}&range=${selectedRange}`;
                                                    }}
                                                >
                                                    {player.name}
                                                </Link>
                                            </div>
                                            <span className="text-sm font-medium text-purple-700">
                                                {player.count} times
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-purple-900 mb-2">Most knocked out:</div>
                                <div className="space-y-2">
                                    {stats.mostKnockedOut.map((player, index) => (
                                        <div key={player.name} className="flex items-baseline justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-purple-700">{index + 1}.</span>
                                                <a
                                                    href={`/players?name=${encodeURIComponent(player.name)}&range=${selectedRange}`}
                                                    className="freeroll-link"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        window.location.href = `/players?name=${encodeURIComponent(player.name)}&range=${selectedRange}`;
                                                    }}
                                                >
                                                    {player.name}
                                                </a>
                                            </div>
                                            <span className="text-sm font-medium text-purple-700">
                                                {player.count} times
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>)
                }


                {/* Venue Points */}
                <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="bg-green-50 p-4 rounded-t-xl border-b border-green-100">
                        <h3 className="font-bold text-lg text-green-900">Points by Venue</h3>
                    </div>
                    <div className="p-4">
                        <div className="space-y-3">
                            {stats.venueStats.map(venue => (
                                <div key={venue.venue} className="flex justify-between items-center">
                                    <Link
                                        href={`/venues?venue=${encodeURIComponent(venue.venue)}`}
                                        className="freeroll-link"
                                    >
                                        {venue.venue}
                                    </Link>
                                    <span className="font-medium text-green-600">{venue.points}</span>

                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Placement Frequency */}
                {stats?.placementFrequency && (
                    <PlacementFrequencyChart data={stats.placementFrequency} />
                )}

                {/* Recent Games */}
                <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="bg-amber-50 p-4 rounded-t-xl border-b border-amber-100">
                        <h3 className="font-bold text-lg text-amber-900">Recent Games</h3>
                    </div>
                    <div className="p-4">
                        <div className="space-y-4">
                            {stats.recentGames.slice(0, 5).map((game, index) => (
                                <Link
                                    key={index}
                                    href={`/games/${encodeURIComponent(game.fileName)}`}
                                    className="block border-b border-gray-100 last:border-0 pb-3 last:pb-0 hover:bg-gray-50 transition-colors rounded-lg"
                                >
                                    <div className="font-medium text-gray-800">{game.venue}</div>
                                    <div className="text-sm text-gray-500">
                                        {formatGameDate(game.date)}
                                    </div>
                                    <div className="mt-1 text-sm">
                                        <span className="text-amber-600">Place: {game.placement}</span>
                                        <span className="mx-2">•</span>
                                        <span className="text-green-600">Points: {game.points}</span>
                                        <span className="mx-2">•</span>
                                        <span className="text-blue-600">KOs: {game.knockouts}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

// Helper component for consistent stat display
function StatRow({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-gray-600">{label}</span>
            <span className="font-medium text-gray-900">{value}</span>
        </div>
    );
}