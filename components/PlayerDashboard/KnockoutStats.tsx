// components/PlayerDashboard/KnockoutStats.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Swords, Search, User, RefreshCw } from 'lucide-react';
import { formatGameDate } from '@/lib/utils';
import { PlayerSearch } from './PlayerSearch';
import RotatingImageLoader from '../ui/RotatingImageLoader';

interface KnockoutGame {
    date: string;
    venue: string;
    fileName: string;
}

interface KnockoutPlayer {
    name: string;
    uid: string;
    nickname: string | null;
    count: number;
    games: KnockoutGame[];
}

interface PlayerStats {
    uid: string;
    name: string;
    nickname: string | null;
    knockouts: KnockoutGame[];
}

interface HeadToHead {
    player: PlayerStats;
    comparePlayer: PlayerStats;
    gamesPlayed: KnockoutGame[];
}

interface KnockoutStats {
    knockedOutBy: KnockoutPlayer[];
    knockedOut: KnockoutPlayer[];
    totalStats: {
        knockedOutCount: number;
        knockoutCount: number;
    };
    headToHead: HeadToHead | null;
}

interface KnockoutStatsProps {
    playerUID: string;
    playerName: string;
}

export function KnockoutStats({ playerUID, playerName }: KnockoutStatsProps) {
    const [stats, setStats] = useState<KnockoutStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [comparePlayer, setComparePlayer] = useState<{ Name: string; UID: string; nickname: string | null } | null>(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            if (!expanded) return;

            setLoading(true);
            try {
                // Fetch knockout stats
                const compareQueryParam = comparePlayer ? `&compareUid=${comparePlayer.UID}` : '';
                const response = await fetch(`/api/players/${playerUID}/knockouts?${compareQueryParam}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch knockout stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [playerUID, comparePlayer, expanded]);

    const handlePlayerSelect = (player: { Name: string; UID: string; nickname: string | null }) => {
        setComparePlayer(player);
        setSearchVisible(false);
    };

    // Only render content if expanded
    if (!expanded) {
        return (
            <div className="mt-8">
                <button
                    onClick={() => setExpanded(true)}
                    className="w-full py-4 bg-purple-100 text-purple-800 rounded-lg flex items-center justify-center hover:bg-purple-200 transition-colors"
                >
                    <Swords className="mr-2 h-5 w-5" />
                    Show Detailed Knockout Statistics
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mt-8 bg-white rounded-xl shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold flex items-center">
                        <Swords className="mr-3 h-6 w-6 text-purple-600" />
                        Knockout Statistics
                    </h2>
                    <button
                        onClick={() => setExpanded(false)}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        Hide
                    </button>
                </div>
                <div className="flex justify-center py-12">
                    <RotatingImageLoader
                        src="/images/Poker-Chip-Isloated-Blue.png"
                        size="default"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8 bg-white rounded-xl shadow-md">
            <div className="bg-purple-50 p-4 rounded-t-xl border-b border-purple-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-purple-900 flex items-center">
                    <Swords className="mr-2 h-5 w-5" />
                    Knockout Statistics
                </h2>
                <button
                    onClick={() => setExpanded(false)}
                    className="text-purple-700 hover:text-purple-900"
                >
                    Hide
                </button>
            </div>

            <div className="p-4">
                {stats && (
                    <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-black">
                            <div className="bg-red-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <Swords className="h-5 w-5 text-red-600 mr-2" />
                                        <span className="font-medium">Times Knocked Out:</span>
                                    </div>
                                    <span className="text-xl font-bold text-red-600">{stats.totalStats.knockedOutCount}</span>
                                </div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <Swords className="h-5 w-5 text-green-600 mr-2" />
                                        <span className="font-medium">Knockouts:</span>
                                    </div>
                                    <span className="text-xl font-bold text-green-600">{stats.totalStats.knockoutCount}</span>
                                </div>
                            </div>


                        </div>



                        {/* Knockout Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Players Knocked Out By */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-red-50 p-3 border-b">
                                    <h3 className="font-semibold text-red-900">Knocked Out By</h3>
                                </div>
                                <div className="p-3">
                                    {stats.knockedOutBy.length === 0 ? (
                                        <p className="text-gray-500 italic">No knockout data available</p>
                                    ) : (
                                        <div className="space-y-3 max-h-60 overflow-y-auto">
                                            {stats.knockedOutBy.map((player, index) => (
                                                <div key={player.uid} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-800 rounded-full text-sm font-medium">
                                                                {index + 1}
                                                            </div>
                                                            <Link
                                                                href={`/players?uid=${encodeURIComponent(player.uid)}`}
                                                                className="freeroll-link"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    window.location.href = `/players?uid=${encodeURIComponent(player.uid)}`;
                                                                }}
                                                            >
                                                                {player.nickname || player.name}
                                                            </Link>
                                                        </div>
                                                        <div className="text-red-600 text-sm font-medium">
                                                            {player.count} time{player.count !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                    {player.games && player.games.length > 0 && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            Latest: {formatGameDate(player.games[0].date)} at {player.games[0].venue}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Players Knocked Out */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-green-50 p-3 border-b">
                                    <h3 className="font-semibold text-green-900">Knocked Out</h3>
                                </div>
                                <div className="p-3">
                                    {stats.knockedOut.length === 0 ? (
                                        <p className="text-gray-500 italic">No knockout data available</p>
                                    ) : (
                                        <div className="space-y-3 max-h-60 overflow-y-auto">
                                            {stats.knockedOut.map((player, index) => (
                                                <div key={player.uid} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                                                {index + 1}
                                                            </div>
                                                            <Link
                                                                href={`/players?uid=${encodeURIComponent(player.uid)}`}
                                                                className="freeroll-link"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    window.location.href = `/players?uid=${encodeURIComponent(player.uid)}`;
                                                                }}
                                                            >
                                                                {player.nickname || player.name}
                                                            </Link>
                                                        </div>
                                                        <div className="text-green-600 text-sm font-medium">
                                                            {player.count} time{player.count !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                    {player.games && player.games.length > 0 && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            Latest: {formatGameDate(player.games[0].date)} at {player.games[0].venue}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* Player Comparison Search */}
                        <div className="mb-6 border p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4 text-black">Head-to-Head Comparison</h3>
                            {!comparePlayer ? (
                                <div>
                                    {searchVisible ? (
                                        <div className="mb-4">
                                            <PlayerSearch onPlayerSelect={handlePlayerSelect} />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setSearchVisible(true)}
                                            className="w-full py-3 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-colors"
                                        >
                                            <Search className="mr-2 h-5 w-5" />
                                            Search for a player to compare
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-4 text-black">
                                        <span className="font-medium">Comparing with: {comparePlayer.nickname || comparePlayer.Name}</span>
                                        <button
                                            onClick={() => setComparePlayer(null)}
                                            className="text-sm text-red-600 hover:text-red-800"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    {stats.headToHead && (
                                        <div className="grid grid-cols-2 gap-4 text-center">
                                            <div className="bg-green-50 p-3 rounded-lg">
                                                <div className="font-bold text-2xl text-green-700">{stats.headToHead.player.knockouts.length}</div>
                                                <div className="text-sm text-green-600">Knockouts against</div>
                                            </div>
                                            <div className="bg-red-50 p-3 rounded-lg">
                                                <div className="font-bold text-2xl text-red-700">{stats.headToHead.comparePlayer.knockouts.length}</div>
                                                <div className="text-sm text-red-600">Knockouts by</div>
                                            </div>

                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Head-to-Head Match History - Moved to the top */}
                        {stats.headToHead && (
                            <div className="border rounded-lg overflow-hidden mb-6">
                                <div className="bg-blue-50 p-3 border-b">
                                    <h3 className="font-semibold text-blue-900">
                                        Match History: {playerName} vs. {stats.headToHead.comparePlayer.nickname || stats.headToHead.comparePlayer.name}
                                    </h3>
                                </div>
                                <div className="p-4">
                                    {/* Filter to only include games with knockouts */}
                                    {(() => {
                                        // Get games where knockouts occurred
                                        const knockoutGames = stats.headToHead.gamesPlayed.filter(game => {
                                            const p1KnockedOutP2 = stats.headToHead?.player.knockouts.some(
                                                ko => ko.fileName === game.fileName
                                            );
                                            const p2KnockedOutP1 = stats.headToHead?.comparePlayer.knockouts.some(
                                                ko => ko.fileName === game.fileName
                                            );
                                            return p1KnockedOutP2 || p2KnockedOutP1;
                                        });

                                        if (knockoutGames.length === 0) {
                                            return (
                                                <p className="text-gray-500 italic">No knockout encounters found between these players</p>
                                            );
                                        }

                                        return (
                                            <div className="max-h-60 overflow-y-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue</th>
                                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Knockout</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {knockoutGames.map((game, index) => {
                                                            // Determine knockout status
                                                            const p1KnockedOutP2 = stats.headToHead?.player.knockouts.some(
                                                                ko => ko.fileName === game.fileName
                                                            );
                                                            const p2KnockedOutP1 = stats.headToHead?.comparePlayer.knockouts.some(
                                                                ko => ko.fileName === game.fileName
                                                            );

                                                            let outcome;
                                                            if (p1KnockedOutP2) {
                                                                outcome = (
                                                                    <span className="text-green-600 font-medium flex items-center text-xs">
                                                                        <Swords className="h-3 w-3 mr-1" />
                                                                        {playerName} knocked out opponent
                                                                    </span>
                                                                );
                                                            } else if (p2KnockedOutP1) {
                                                                outcome = (
                                                                    <span className="text-red-600 font-medium flex items-center text-xs">
                                                                        <Swords className="h-3 w-3 mr-1" />
                                                                        Opponent knocked out {playerName}
                                                                    </span>
                                                                );
                                                            }

                                                            return (
                                                                <tr key={`${game.fileName}-${index}`}>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{formatGameDate(game.date)}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{game.venue}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap">{outcome}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}