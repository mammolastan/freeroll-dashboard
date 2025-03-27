// components/Rankings/QuarterlyRankings.tsx

import React, { useState, useEffect } from 'react';
import { PlayerRankingCard, DateToggler } from '@/components/Rankings/PlayerRankingCard';
import { ArrowUpDown } from 'lucide-react';
import RotatingImageLoader from '../ui/RotatingImageLoader';
import { useFavorites, FavoriteButton, FavoritesFilter } from './FavoritesComponents';
import { BadgeData } from '../ui/Badge';

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
    nickname: string | null;
    badges?: BadgeData[];
}

interface RankingsData {
    rankings: PlayerRanking[];
    quarter: number;
    year: number;
}

type SortField = 'gamesPlayed' | 'totalPoints' | 'totalKnockouts' | 'finalTables' | 'ranking' | 'avgScore';
type SortDirection = 'asc' | 'desc';

export default function QuarterlyRankings() {
    const [rankingsData, setRankingsData] = useState<RankingsData | null>(null);
    const [isCurrentQuarter, setIsCurrentQuarter] = useState(true);
    const [loading, setLoading] = useState(true);
    const [badgesLoading, setBadgesLoading] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const { favorites, toggleFavorite, isFavorite } = useFavorites();
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

    // Fetch badges for visible players
    useEffect(() => {

        if (!rankingsData?.rankings || rankingsData.rankings.length === 0) return;

        // Skip fetching if we already have badges data for the players
        const alreadyHaveBadges = rankingsData.rankings.some(player => player.badges !== undefined);
        if (alreadyHaveBadges) return;

        const fetchBadges = async () => {
            console.log("Fetching badges for visible players...");
            setBadgesLoading(true);
            try {
                // Get the UIDs of all visible players
                const visiblePlayers = getSortedAndFilteredRankings();
                const playerUids = visiblePlayers.map(player => player.uid);

                if (playerUids.length === 0) return;

                // Fetch badges for all players in a single request
                const response = await fetch('/api/players/badges/batch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ uids: playerUids }),
                });

                if (!response.ok) throw new Error('Failed to fetch player badges');

                const badgesData = await response.json();

                // Update player data with badges
                setRankingsData(prev => {
                    if (!prev) return null;

                    const updatedRankings = prev.rankings.map(player => {
                        const playerBadges = badgesData[player.uid] || [];
                        return {
                            ...player,
                            badges: playerBadges
                        };
                    });

                    return {
                        ...prev,
                        rankings: updatedRankings
                    };
                });
            } catch (error) {
                console.error('Error fetching player badges:', error);
            } finally {
                console.log("Finished fetching badges for visible players...");
                setBadgesLoading(false);
            }
        };

        fetchBadges();

    }, [rankingsData]); // Only re-run when the rankingsData changes

    const handleSort = (field: SortField) => {
        setSortConfig(prevConfig => ({
            field,
            direction: prevConfig.field === field && prevConfig.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getSortedAndFilteredRankings = () => {
        if (!rankingsData?.rankings) return [];

        let filteredRankings = rankingsData.rankings;

        // Apply name or nickname filter
        if (filterText) {
            filteredRankings = filteredRankings.filter(player =>
                player.name.toLowerCase().includes(filterText.toLowerCase()) ||
                (player.nickname && player.nickname.toLowerCase().includes(filterText.toLowerCase()))
            );
        }

        // Apply favorites filter
        if (showFavoritesOnly) {
            filteredRankings = filteredRankings.filter(player =>
                isFavorite(player.uid)
            );
        }


        // Apply sort
        return [...filteredRankings].sort((a, b) => {
            let valueA = a[sortConfig.field];
            let valueB = b[sortConfig.field];
            const multiplier = sortConfig.direction === 'asc' ? 1 : -1;

            if (typeof valueA === 'string') valueA = parseFloat(valueA);
            if (typeof valueB === 'string') valueB = parseFloat(valueB);

            if (!valueA && valueA !== 0) valueA = -Infinity;
            if (!valueB && valueB !== 0) valueB = -Infinity;

            return (valueA - valueB) * multiplier;
        });
    };

    const SortableHeader = ({ field, label, bg }: { field: SortField; label: string; bg: string }) => (
        <button
            onClick={() => handleSort(field)}
            className={`bg-${bg}-50 flex flex-col items-center p-2 w-full transition-colors
                ${field === sortConfig.field ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
        >
            <div className="flex items-center gap-1">
                <span className="text-gray-600">{label}</span>
                <ArrowUpDown size={14} className={`transition-opacity ${field === sortConfig.field ? 'opacity-100' : 'opacity-50'
                    }`} />
            </div>
        </button>
    );

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
                    <FavoritesFilter
                        showFavoritesOnly={showFavoritesOnly}
                        onToggle={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        favoritesCount={favorites.length}
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
                {/* Badge loading indicator */}
                {badgesLoading && (
                    <div className="text-sm text-gray-500 mb-2">
                        Loading player achievements...
                    </div>
                )}
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
                            <div className="grid grid-cols-2 sm:grid-cols-5 text-sm">
                                <SortableHeader field="totalPoints" label="Points" bg="green" />
                                <SortableHeader field="avgScore" label="Power Rating" bg="orange" />
                                <SortableHeader field="finalTables" label="Final Tables" bg="purple" />
                                <SortableHeader field="gamesPlayed" label="Games" bg="blue" />
                                <SortableHeader field="totalKnockouts" label="KOs" bg="red" />
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
                                favoriteButton={
                                    <FavoriteButton
                                        uid={player.uid}
                                        isFavorite={isFavorite(player.uid)}
                                        onToggle={toggleFavorite}
                                    />
                                }
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}