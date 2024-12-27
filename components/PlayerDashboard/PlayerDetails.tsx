import { useState, useEffect } from 'react';
import { DateRangeSelector } from './DateRangeSelector';

interface PlayerStats {
    quarterlyStats: {
        gamesPlayed: number
        totalPoints: number
        knockouts: number
        finalTables: number
        avgScore: number
    }
    mostKnockedOutBy: Array<{
        name: string
        count: number
    }>
    mostKnockedOut: Array<{
        name: string
        count: number
    }>
    venueStats: Array<{
        venue: string
        points: number
    }>
    recentGames: Array<{
        date: string
        venue: string
        placement: number
        points: number
        knockouts: number
        fileName: string
    }>
}

interface PlayerDetailsProps {
    playerUID: string
    playerName: string
}
function formatDateRangeText(
    startDate: Date | null,
    endDate: Date | null,
    selectedRange: string,
    earliestGameDate: string | null
): string {
    // Type guard to ensure startDate is not null
    if (startDate === null) {
        if (!earliestGameDate) {
            return "No stats available";
        }

        // All-time case
        const earliest = new Date(earliestGameDate);

        return `Stats from ${earliest.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        })} - Current`;
    }

    if (selectedRange === 'current-month') {
        return `Stats for ${startDate.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        })}`;
    }

    if (selectedRange.includes('Q')) {
        const quarterNum = parseInt(selectedRange.charAt(1));
        const year = parseInt(selectedRange.split('-')[1]);
        return `Stats for Q${quarterNum} ${year}`;
    }

    if (endDate) {
        return `Stats from ${startDate.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        })} to ${endDate.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        })}`;
    }

    return `Stats from ${startDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    })}`;
}
function getMonthRangeText(selectedRange: string): string {
    if (selectedRange === 'current-month') {
        return "December";
    }

    if (selectedRange.includes('Q')) {
        const quarterNum = parseInt(selectedRange.charAt(1));
        switch (quarterNum) {
            case 1: return "January - March";
            case 2: return "April - June";
            case 3: return "July - September";
            case 4: return "October - December";
            default: return "";
        }
    }

    return "";
}

function parseGameDate(fileName: string, season: string): Date {
    try {
        // Extract the date portion (e.g., "1230" from "1230_indy_bb.tdt")
        const datePart = fileName.split('_')[0];

        // Get year from season (e.g., "2024" from "December 2024")
        const year = parseInt(season.split(' ').pop() || '2024');

        // Parse month and day
        const month = parseInt(datePart.substring(0, 2)) - 1; // Subtract 1 as months are 0-based
        const day = parseInt(datePart.substring(2, 4));

        // Validate the components
        if (month < 0 || month > 11 || day < 1 || day > 31 || isNaN(year)) {
            throw new Error('Invalid date components');
        }

        return new Date(year, month, day);
    } catch (error) {
        console.error('Error parsing date:', { error, fileName, season });
        return new Date(); // Fallback to current date if parsing fails
    }
}


export function PlayerDetails({ playerUID, playerName }: PlayerDetailsProps) {

    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState(() => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
        return `Q${currentQuarter}-${currentYear}`;
    });
    const [startDate, setStartDate] = useState<Date | null>(() => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentQuarter = Math.floor(currentDate.getMonth() / 3);
        return new Date(Date.UTC(currentYear, currentQuarter * 3, 1));
    });
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [earliestGameDate, setEarliestGameDate] = useState<string | null>(null);
    useEffect(() => {
        async function fetchPlayerStats() {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (startDate) params.append('startDate', startDate.toISOString());
                if (endDate) params.append('endDate', endDate.toISOString());

                const response = await fetch(
                    `/api/players/${playerUID}/stats?${params.toString()}`
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // Ensure we have default values if data is missing
                const processedData = {
                    quarterlyStats: {
                        gamesPlayed: data.quarterlyStats?.gamesPlayed ?? 0,
                        totalPoints: data.quarterlyStats?.totalPoints ?? 0,
                        knockouts: data.quarterlyStats?.knockouts ?? 0,
                        finalTables: data.quarterlyStats?.finalTables ?? 0,
                        avgScore: Number(data.quarterlyStats?.avgScore ?? 0),
                    },
                    mostKnockedOutBy: data.mostKnockedOutBy ?? [],
                    mostKnockedOut: data.mostKnockedOut ?? [],
                    venueStats: data.venueStats ?? [],
                    recentGames: data.recentGames ?? [],
                };

                setStats(processedData);
                if (data.earliestGameDate) {
                    setEarliestGameDate(data.earliestGameDate);
                }
            } catch (error) {
                console.error('Failed to fetch player stats:', error);
                // Set default empty state
                setStats({
                    quarterlyStats: {
                        gamesPlayed: 0,
                        totalPoints: 0,
                        knockouts: 0,
                        finalTables: 0,
                        avgScore: 0,
                    },
                    mostKnockedOutBy: [],
                    mostKnockedOut: [],
                    venueStats: [],
                    recentGames: [],
                });
            } finally {
                setLoading(false);
            }
        }

        if (playerUID) {
            fetchPlayerStats();
        }
    }, [playerUID, startDate, endDate]);
    console.log("selectedRange");
    console.log(selectedRange);
    if (loading) {
        return (
            <div className="text-center py-12 text-gray-600">
                <div className="animate-pulse">Loading stats for {playerName}...</div>
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
                <DateRangeSelector
                    selectedRange={selectedRange}
                    onRangeChange={(newStartDate, newEndDate, newRange) => {
                        setStartDate(newStartDate);
                        setEndDate(newEndDate);
                        setSelectedRange(newRange);
                    }}
                />
            </div>
            <div className="flex flex-col">
                <div className="text-xl font-medium text-white-600">
                    {formatDateRangeText(startDate ?? null, endDate ?? null, selectedRange, earliestGameDate)}
                </div>
                <div className="text-sm text-gray-500">
                    {getMonthRangeText(selectedRange)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* This time period Stats */}
                <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="bg-blue-50 p-4 rounded-t-xl border-b border-blue-100">
                        <h3 className="font-bold text-lg text-blue-900">Current time period</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        <StatRow label="Games Played" value={stats.quarterlyStats.gamesPlayed} />
                        <StatRow label="Total Points" value={stats.quarterlyStats.totalPoints} />
                        <StatRow label="Knockouts" value={stats.quarterlyStats.knockouts} />
                        <StatRow label="Final Tables" value={stats.quarterlyStats.finalTables} />
                        <StatRow
                            label="Avg Score"
                            value={typeof stats.quarterlyStats.avgScore === 'number'
                                ? stats.quarterlyStats.avgScore.toFixed(2)
                                : '0.00'}
                        />
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
                                                <span className="font-medium text-gray-900">{player.name}</span>
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
                                                <span className="font-medium text-gray-900">{player.name}</span>
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
                                    <a
                                        href={`/venues?venue=${encodeURIComponent(venue.venue)}`}
                                        className="text-gray-700 hover:text-blue-600 transition-colors"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            window.location.href = `/venues?venue=${encodeURIComponent(venue.venue)}`;
                                        }}
                                    >
                                        {venue.venue}
                                    </a>
                                    <span className="font-medium text-green-600">{venue.points}</span>

                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Recent Games */}
                <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="bg-amber-50 p-4 rounded-t-xl border-b border-amber-100">
                        <h3 className="font-bold text-lg text-amber-900">Recent Games</h3>
                    </div>
                    <div className="p-4">
                        <div className="space-y-4">
                            {stats.recentGames.slice(0, 5).map((game, index) => (
                                <div key={index} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                                    <div className="font-medium text-gray-800">{game.venue}</div>
                                    <div className="text-sm text-gray-500">
                                        {parseGameDate(game.fileName, game.date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </div>
                                    <div className="mt-1 text-sm">
                                        <span className="text-amber-600">Place: {game.placement}</span>
                                        <span className="mx-2">•</span>
                                        <span className="text-green-600">Points: {game.points}</span>
                                        <span className="mx-2">•</span>
                                        <span className="text-blue-600">KOs: {game.knockouts}</span>
                                    </div>
                                </div>
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