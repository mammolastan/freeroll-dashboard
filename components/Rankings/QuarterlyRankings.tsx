import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PlayerRankingCard, DateToggler } from '@/components/Rankings/PlayerRankingCard';

interface PlayerRanking {
    name: string;
    uid: string;
    gamesPlayed: number;
    totalPoints: number;
    totalKnockouts: number;
    finalTables: number;
    avgScore: number;
    ranking: number;
    isQualified: boolean;
}

interface RankingsData {
    rankings: PlayerRanking[];
    quarter: number;
    year: number;
}

export default function QuarterlyRankings() {
    const [rankingsData, setRankingsData] = useState<RankingsData | null>(null);
    const [isCurrentQuarter, setIsCurrentQuarter] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const getQuarterLabel = (quarter: number) => {
        const quarters: Record<number, string> = {
            1: 'January - March',
            2: 'April - June',
            3: 'July - September',
            4: 'October - December'
        };
        return quarters[quarter];
    };

    const currentDate = new Date();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
    const previousQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
    const previousQuarterYear = currentQuarter === 1 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

    useEffect(() => {
        async function fetchRankings() {
            setIsTransitioning(true);
            try {
                const response = await fetch(`/api/rankings/quarterly?currentQuarter=${isCurrentQuarter}`);
                if (!response.ok) throw new Error('Failed to fetch rankings');
                const data = await response.json();
                console.log("rankings data returned");
                console.log(data);

                // Ensure rankings are properly sorted by ranking field
                const sortedRankings = {
                    ...data,
                    rankings: [...data.rankings].sort((a, b) => a.ranking - b.ranking)
                };

                setRankingsData(sortedRankings);
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
    }, [isCurrentQuarter]);

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
                <DateToggler
                    isCurrentPeriod={isCurrentQuarter}
                    setIsCurrentPeriod={setIsCurrentQuarter}
                    currentLabel={`Q${currentQuarter} ${currentDate.getFullYear()}`}
                    previousLabel={`Q${previousQuarter} ${previousQuarterYear}`}
                />
                <div className="text-xl text-gray-600">No players found for this quarter</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Non-sticky header section */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">
                    Quarterly Rankings - Q{rankingsData.quarter} {rankingsData.year}
                </h2>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <DateToggler
                        isCurrentPeriod={isCurrentQuarter}
                        setIsCurrentPeriod={setIsCurrentQuarter}
                        currentLabel={`Q${currentQuarter} ${currentDate.getFullYear()}`}
                        previousLabel={`Q${previousQuarter} ${previousQuarterYear}`}
                    />
                    <div className="text-gray-600">
                        {getQuarterLabel(rankingsData.quarter)}
                    </div>
                </div>
            </div>

            {/* Rankings section with sticky header */}
            <div className="relative">
                {/* Sticky column headers */}
                <div className="md:sticky relative top-0 bg-white shadow-sm z-10 border-b">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="text-lg font-medium text-gray-600 truncate">
                                    Player
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="grid grid-cols-2 sm:grid-cols-4 text-sm">
                                <div className="flex flex-col items-center p-2 bg-blue-50">
                                    <span className="text-gray-600">Games</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-green-50">
                                    <span className="text-gray-600">Points</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-red-50">
                                    <span className="text-gray-600">KOs</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-purple-50">
                                    <span className="text-gray-600">Final Tables</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable player rankings */}
                <div>
                    {rankingsData.rankings.map((player, index) => {
                        // Create a unique key using multiple unique identifiers
                        const uniqueKey = `${player.uid}-${rankingsData.quarter}-${rankingsData.year}-${index}-${isCurrentQuarter ? 'current' : 'previous'}`;

                        return (
                            <PlayerRankingCard
                                key={uniqueKey}
                                player={{
                                    ...player,
                                    type: 'quarterly'
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}