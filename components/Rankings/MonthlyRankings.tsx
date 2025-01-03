import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronRight, ChevronLeft, Award, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface VenueRanking {
    venue: string;
    rank: number;
}

interface PlayerRanking {
    rank: number;
    name: string;
    uid: string;
    totalPoints: number;
    qualifyingVenues: VenueRanking[];
    bubbleVenues: VenueRanking[];
    isQualified: boolean;
    isBubble: boolean;
}

interface RankingsData {
    rankings: PlayerRanking[];
    month: string;
    year: number;
}

export default function MonthlyRankings() {
    const [rankingsData, setRankingsData] = useState<RankingsData | null>(null);
    const [isCurrentMonth, setIsCurrentMonth] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        async function fetchRankings() {
            setIsTransitioning(true);
            try {
                const response = await fetch(`/api/rankings/monthly?currentMonth=${isCurrentMonth}`);
                if (!response.ok) throw new Error('Failed to fetch rankings');
                const data = await response.json();
                setRankingsData(data);
            } catch (error) {
                console.error('Error fetching rankings:', error);
            } finally {
                setTimeout(() => {
                    setLoading(false);
                    setIsTransitioning(false);
                }, 300);
            }
        }
        fetchRankings();
    }, [isCurrentMonth]);

    if (loading && !isTransitioning) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-xl text-gray-600 animate-pulse">Loading rankings...</div>
            </div>
        );
    }

    if (!rankingsData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-xl text-gray-600">No rankings available</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">
                    Monthly Rankings - {rankingsData.month} {rankingsData.year}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCurrentMonth(false)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300
              ${!isCurrentMonth
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                            }`}
                    >
                        <ChevronLeft size={16} className={!isCurrentMonth ? 'opacity-0' : 'opacity-100'} />
                        <span>Previous Month</span>
                    </button>
                    <button
                        onClick={() => setIsCurrentMonth(true)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300
              ${isCurrentMonth
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                            }`}
                    >
                        <span>Current Month</span>
                        <ChevronRight size={16} className={isCurrentMonth ? 'opacity-0' : 'opacity-100'} />
                    </button>
                </div>
            </div>

            <div className="mt-4">
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qualifying Venues</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {rankingsData.rankings.map((player) => (
                                        <tr
                                            key={player.uid}
                                            className={`
                        ${player.isQualified ? 'bg-green-50' : ''}
                        ${player.isBubble ? 'bg-green-50/50' : ''}
                        hover:bg-opacity-80 transition-colors
                      `}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{player.rank}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Link
                                                    href={`/players?name=${encodeURIComponent(player.name)}`}
                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                                >
                                                    {player.name}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{player.totalPoints}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {player.isQualified ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <Award className="w-4 h-4 mr-1" />
                                                        Qualified
                                                    </span>
                                                ) : player.isBubble ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        <AlertCircle className="w-4 h-4 mr-1" />
                                                        Bubble
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">
                                                    {player.isQualified ? (
                                                        <div className="space-y-1">
                                                            {player.qualifyingVenues.map((venue) => (
                                                                <div key={venue.venue} className="flex items-center space-x-2">
                                                                    <Link
                                                                        href={`/venues?venue=${encodeURIComponent(venue.venue)}`}
                                                                        className="text-blue-600 hover:text-blue-800"
                                                                    >
                                                                        {venue.venue}
                                                                    </Link>
                                                                    <span className="text-gray-500">#{venue.rank}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : player.isBubble ? (
                                                        <div className="space-y-1">
                                                            {player.bubbleVenues.map((venue) => (
                                                                <div key={venue.venue} className="flex items-center space-x-2 text-gray-500">
                                                                    <Link
                                                                        href={`/venues?venue=${encodeURIComponent(venue.venue)}`}
                                                                        className="text-blue-600 hover:text-blue-800"
                                                                    >
                                                                        {venue.venue}
                                                                    </Link>
                                                                    <span>#{venue.rank}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}