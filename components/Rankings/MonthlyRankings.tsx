import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronRight, ChevronLeft, Award, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface VenueRanking {
    venue: string;
    rank: number;
    points: number;
}

interface PlayerRanking {
    name: string;
    uid: string;
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
    const [selectedVenue, setSelectedVenue] = useState<string>('all');
    const [availableVenues, setAvailableVenues] = useState<string[]>([]);

    useEffect(() => {
        async function fetchRankings() {
            setIsTransitioning(true);
            try {
                const response = await fetch(`/api/rankings/monthly?currentMonth=${isCurrentMonth}`);
                if (!response.ok) throw new Error('Failed to fetch rankings');
                const data = await response.json();

                // Filter to only include qualified and bubble players
                const filteredRankings = {
                    ...data,
                    rankings: data.rankings.filter(
                        (player: PlayerRanking): boolean => player.isQualified || player.isBubble
                    ),
                };

                // Extract unique venues from all players' qualifying and bubble venues
                const venues = new Set<string>();
                filteredRankings.rankings.forEach((player: PlayerRanking) => {
                    player.qualifyingVenues.forEach((v: VenueRanking) => venues.add(v.venue));
                    player.bubbleVenues.forEach((v: VenueRanking) => venues.add(v.venue));
                });
                setAvailableVenues(Array.from(venues).sort());

                setRankingsData(filteredRankings);
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

    const getFilteredRankings = (): PlayerRanking[] => {
        if (!rankingsData?.rankings) return [];
        if (selectedVenue === 'all') return rankingsData.rankings;

        const filteredRankings = rankingsData.rankings
            .filter(player => player.qualifyingVenues.some(venue => venue.venue === selectedVenue))
            .sort((a, b) => {
                const aVenue = a.qualifyingVenues.find(venue => venue.venue === selectedVenue);
                const bVenue = b.qualifyingVenues.find(venue => venue.venue === selectedVenue);
                return (aVenue?.rank ?? Infinity) - (bVenue?.rank ?? Infinity);
            });

        return filteredRankings;
    };

    if (loading && !isTransitioning) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-xl text-gray-600 animate-pulse">Loading rankings...</div>
            </div>
        );
    }

    if (!rankingsData?.rankings.length) {
        return (
            <div className="flex items-center justify-center min-h-[400px] gap-4">
                <DateToggler isCurrentMonth={isCurrentMonth} setIsCurrentMonth={setIsCurrentMonth} />
                <div className="text-xl text-gray-600">No qualified players found for this month</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold">
                    Monthly Tournament Qualifiers - {rankingsData.month} {rankingsData.year}
                </h2>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 my-5">
                <DateToggler isCurrentMonth={isCurrentMonth} setIsCurrentMonth={setIsCurrentMonth} />
                <select
                    value={selectedVenue}
                    onChange={(e) => setSelectedVenue(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Venues</option>
                    {availableVenues.map(venue => (
                        <option key={venue} value={venue}>{venue}</option>
                    ))}
                </select>

            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qualifying Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {getFilteredRankings().map((player) => (
                                    <tr
                                        key={player.uid}
                                        className={`
                      ${player.isQualified ? 'bg-green-50' : ''}
                      ${player.isBubble ? 'bg-green-50/50' : ''}
                      hover:bg-opacity-80 transition-colors
                    `}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/players?name=${encodeURIComponent(player.name)}`}
                                                className="text-sm font-medium text-blue-600 freeroll-link"
                                            >
                                                {player.name}
                                            </Link>
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
                                                {
                                                    (player.isQualified || player.isBubble) && (
                                                        <div className="space-y-1">
                                                            {player.qualifyingVenues
                                                                .sort((a, b) => {
                                                                    if (a.venue === selectedVenue) return -1;
                                                                    if (b.venue === selectedVenue) return 1;
                                                                    return 0;
                                                                })
                                                                .map((venue) => (
                                                                    <div key={venue.venue} className="flex items-center space-x-2">
                                                                        <Link
                                                                            href={`/venues?venue=${encodeURIComponent(venue.venue)}`}
                                                                            className="text-blue-600 freeroll-link"
                                                                        >
                                                                            {venue.venue}
                                                                        </Link>
                                                                        <span className="text-gray-500">#{venue.rank} ({venue.points} pts)</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )
                                                }
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
    );
}

function DateToggler({ isCurrentMonth, setIsCurrentMonth }: { isCurrentMonth: boolean; setIsCurrentMonth: React.Dispatch<React.SetStateAction<boolean>> }) {
    return (
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
    );
}