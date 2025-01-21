import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PlayerRankingCard, DateToggler } from '@/components/Rankings/PlayerRankingCard';
import { ArrowUpDown } from 'lucide-react';

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

type SortField = 'gamesPlayed' | 'totalPoints' | 'totalKnockouts' | 'finalTables' | 'ranking';
type SortDirection = 'asc' | 'desc';

export default function QuarterlyRankings() {
    const [rankingsData, setRankingsData] = useState<RankingsData | null>(null);
    const [isCurrentQuarter, setIsCurrentQuarter] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [sortConfig, setSortConfig] = useState<{
        field: SortField;
        direction: SortDirection;
    }>({
        field: 'ranking',
        direction: 'asc'
    });

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
    }, [isCurrentQuarter]);

    const handleSort = (field: SortField) => {
        setSortConfig(prevConfig => ({
            field,
            direction: prevConfig.field === field && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortedAndFilteredRankings = () => {
        if (!rankingsData?.rankings) return [];

        let filteredRankings = rankingsData.rankings;

        // Apply filter
        if (filterText) {
            filteredRankings = filteredRankings.filter(player =>
                player.name.toLowerCase().includes(filterText.toLowerCase())
            );
        }

        // Apply sort
        return [...filteredRankings].sort((a, b) => {
            const valueA = a[sortConfig.field];
            const valueB = b[sortConfig.field];
            const multiplier = sortConfig.direction === 'asc' ? 1 : -1;

            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return (valueA - valueB) * multiplier;
            }
            return 0;
        });
    };

    const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
        <button
            onClick={() => handleSort(field)}
            className={`flex flex-col items-center p-2 w-full transition-colors
                ${field === sortConfig.field ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
        >
            <div className="flex items-center gap-1">
                <span className="text-gray-600">{label}</span>
                <ArrowUpDown size={14} className={`transition-opacity ${field === sortConfig.field ? 'opacity-100' : 'opacity-50'
                    }`} />
            </div>
        </button>
    );

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

    const sortedAndFilteredRankings = getSortedAndFilteredRankings();

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header section */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">
                    Quarterly Rankings - Q{rankingsData.quarter} {rankingsData.year}
                </h2>

                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
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

                {/* Search filter */}
                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="Filter by player name..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="text-black w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {filterText && (
                        <button
                            onClick={() => setFilterText('')}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                            &times;
                        </button>
                    )}
                </div>
            </div>

            {/* Rankings section with sticky header */}
            <div className="relative">
                {/* Sticky column headers */}
                <div className="md:sticky top-0 bg-white shadow-sm z-10 border-b">
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
                                <SortableHeader field="gamesPlayed" label="Games" />
                                <SortableHeader field="totalPoints" label="Points" />
                                <SortableHeader field="totalKnockouts" label="KOs" />
                                <SortableHeader field="finalTables" label="Final Tables" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Player rankings */}
                <div>
                    {sortedAndFilteredRankings.map((player, index) => {
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