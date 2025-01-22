// components/Rankings/MonthlyRankings.tsx

import React, { useState, useEffect } from 'react';
import { PlayerRankingCard, DateToggler } from '@/components/Rankings/PlayerRankingCard';
import RotatingImageLoader from '../ui/RotatingImageLoader';

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

interface PlayerRankingCardProps {
    player: PlayerRanking;
}

interface DateTogglerProps {
    isCurrentMonth: boolean;
    setIsCurrentMonth: React.Dispatch<React.SetStateAction<boolean>>;
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
                        (player: PlayerRanking) => player.isQualified || player.isBubble
                    ),
                };

                // Extract unique venues from all players' qualifying and bubble venues
                const venues = new Set<string>();
                filteredRankings.rankings.forEach((player: PlayerRanking) => {
                    player.qualifyingVenues.forEach((v: VenueRanking) => venues.add(v.venue));
                    player.bubbleVenues.forEach((v: VenueRanking) => venues.add(v.venue));
                });
                setAvailableVenues(Array.from(venues).sort());
                console.log("filteredRankings")
                console.log(filteredRankings)
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

        return rankingsData.rankings
            .map(player => {
                // Sort qualifyingVenues to put selectedVenue at the top
                player.qualifyingVenues.sort((a, b) => {
                    if (a.venue === selectedVenue) return -1;
                    if (b.venue === selectedVenue) return 1;
                    return 0;
                });
                return player;
            })
            .filter(player => player.qualifyingVenues.some(venue => venue.venue === selectedVenue))
            .sort((a, b) => {
                const aVenue = a.qualifyingVenues.find(venue => venue.venue === selectedVenue);
                const bVenue = b.qualifyingVenues.find(venue => venue.venue === selectedVenue);
                return (aVenue?.rank ?? Infinity) - (bVenue?.rank ?? Infinity);
            });
    };

    if (loading && isTransitioning) {
        return (
            <div className="text-center py-12 text-gray-600">
                <RotatingImageLoader
                    src="/images/Poker-Chip-Isloated-Blue.png"
                    size="large"
                />
            </div>
        );
    }

    if (!rankingsData?.rankings.length) {
        return (
            <div className="flex items-center justify-center min-h-[400px] gap-4">
                <div className="text-xl text-gray-600">No qualified players found for this month</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header Section */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">
                    Monthly Tournament Qualifiers - {rankingsData?.month} {rankingsData?.year}
                </h2>
                <p className='pb-4'>
                    Players qualify for the monthly tournament by ranking in the top 5 for any given venue. Bubble players are next in line.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">

                    <DateToggler
                        isCurrentPeriod={isCurrentMonth}
                        setIsCurrentPeriod={setIsCurrentMonth}
                        currentLabel="Current Month"
                        previousLabel="Previous Month"
                    />
                    <select
                        value={selectedVenue}
                        onChange={(e) => setSelectedVenue(e.target.value)}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 bg-white 
              text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Venues</option>
                        {availableVenues.map(venue => (
                            <option key={venue} value={venue}>{venue}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Rankings Grid */}

            <div className="">
                {getFilteredRankings().map((player) => {

                    return (
                        <PlayerRankingCard
                            key={player.uid}
                            player={{ ...player, type: 'monthly' }}
                        />
                    );
                })}
            </div>
        </div >
    );
}