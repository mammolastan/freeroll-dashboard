// components/Rankings/QuarterlyRankings.tsx

import React, { useState, useEffect } from 'react';
import { QuarterlyPlayerCard } from './QuarterlyPlayerCard'; // Updated import
import { ArrowUpDown, Trophy, Zap, Hexagon, LandPlot, Calculator, Swords } from 'lucide-react';
import RotatingImageLoader from '../ui/RotatingImageLoader';
import { useFavorites, FavoritesFilter } from './FavoritesComponents';
import { BadgeData } from '../ui/Badge';
import { QualificationBarrier } from './QualificationBarrier';

interface PlayerRanking {
    name: string;
    uid: string;
    gamesPlayed: number;
    totalPoints: number;
    totalKnockouts: number;
    finalTables: number;
    avgScore: number;
    finalTablePercentage: number;
    pointsPerGame: number;
    ranking: number;
    isQualified: boolean;
    nickname: string | null;
    photoUrl: string | null;
    badges?: BadgeData[];
}

interface RankingsData {
    rankings: PlayerRanking[];
    quarter: number;
    year: number;
}

type SortField = 'totalPoints' | 'totalKnockouts' | 'finalTables' | 'ranking' | 'avgScore' | 'finalTablePercentage' | 'pointsPerGame';
type SortDirection = 'asc' | 'desc';

interface QuarterOption {
    quarter: number;
    year: number;
    label: string;
    value: string;
}

// Helper function to generate quarter options
function generateQuarterOptions(): QuarterOption[] {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;

    const options: QuarterOption[] = [];

    let year = currentYear;
    let quarter = currentQuarter;

    // Generate 6 quarters (current + 5 previous)
    for (let i = 0; i < 6; i++) {
        const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
        const monthRanges = [
            'Jan - Mar',
            'Apr - Jun',
            'Jul - Sep',
            'Oct - Dec'
        ];

        options.push({
            quarter,
            year,
            label: `${quarterLabels[quarter - 1]} ${year} (${monthRanges[quarter - 1]})`,
            value: `${quarter}-${year}`
        });

        // Move to previous quarter
        quarter--;
        if (quarter === 0) {
            quarter = 4;
            year--;
        }
    }

    return options;
}

// Helper function to parse quarter from URL or get default
function getSelectedQuarterFromURL(): string {
    if (typeof window === 'undefined') return '';

    const urlParams = new URLSearchParams(window.location.search);
    const quarterParam = urlParams.get('quarter');

    if (quarterParam && /^\d-\d{4}$/.test(quarterParam)) {
        return quarterParam;
    }

    // Default to current quarter
    const currentDate = new Date();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
    const currentYear = currentDate.getFullYear();
    return `${currentQuarter}-${currentYear}`;
}

export default function QuarterlyRankings() {
    const [rankingsData, setRankingsData] = useState<RankingsData | null>(null);
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

    // Generate quarter options and get selected quarter
    const quarterOptions = generateQuarterOptions();
    const [selectedQuarter, setSelectedQuarter] = useState<string>(() => getSelectedQuarterFromURL());

    // Update URL when quarter changes
    const updateURL = (quarterValue: string) => {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        url.searchParams.set('quarter', quarterValue);
        window.history.replaceState({}, '', url.toString());
    };

    const handleQuarterChange = (quarterValue: string) => {
        setSelectedQuarter(quarterValue);
        updateURL(quarterValue);
    };

    useEffect(() => {
        async function fetchRankings() {
            setIsTransitioning(true);
            try {
                const [quarter, year] = selectedQuarter.split('-').map(Number);
                const response = await fetch(`/api/rankings/quarterly?quarter=${quarter}&year=${year}`);
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

        if (selectedQuarter) {
            fetchRankings();
        }
    }, [selectedQuarter]);

    // Fetch badges for visible players
    useEffect(() => {
        if (!rankingsData?.rankings || rankingsData.rankings.length === 0) return;

        // Skip fetching if we already have badges data for the players
        const alreadyHaveBadges = rankingsData.rankings.some(player => player.badges !== undefined);
        if (alreadyHaveBadges) return;

        const fetchBadges = async () => {
            console.log("Fetching badges for all players...");
            setBadgesLoading(true);
            try {
                // Get the UIDs of all players
                const playerUids = rankingsData.rankings.map(player => player.uid);

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
    }, [rankingsData]);

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

    const SortableHeader = ({ field, label, bg, icon }: { field: SortField; label: string; bg: string; icon: string }) => {
        // Icon mapping
        const iconMap: Record<string, React.ElementType> = {
            Trophy,
            Zap,
            Hexagon,
            LandPlot,
            Calculator,
            Swords
        };

        const IconComponent = iconMap[icon];

        return (
            <button
                onClick={() => handleSort(field)}
                className={`${bg} flex flex-col items-center p-2 w-full transition-colors`}
            >
                <div className="flex items-center gap-1">
                    {IconComponent && <IconComponent size={14} className="text-gray-600" />}
                    <span className="text-gray-600">{label}</span>
                    <ArrowUpDown
                        size={14}
                        className={`text-blue-600 transition-opacity ${field === sortConfig.field || (field === 'totalPoints' && sortConfig.field === 'ranking')
                            ? 'opacity-100'
                            : 'opacity-20'
                            }`}
                    />
                </div>
            </button>
        );
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
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-white mb-2">
                        Select Quarter:
                    </label>
                    <select
                        value={selectedQuarter}
                        onChange={(e) => handleQuarterChange(e.target.value)}
                        className="text-black px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {quarterOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="text-xl text-white">No games yet for this quarter (Q{rankingsData?.quarter} {rankingsData?.year}). Check back soon. </div>
            </div>
        );
    }

    const sortedAndFilteredRankings = getSortedAndFilteredRankings();

    return (
        <div className="container mx-auto py-8">
            {/* Header section */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">
                    Quarterly Rankings - Q{rankingsData.quarter} {rankingsData.year}
                </h2>

                <div className="flex flex-col sm:flex-row items-center lg:items-end gap-4 mb-4">
                    {/* Quarter Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Quarter:
                        </label>
                        <select
                            value={selectedQuarter}
                            onChange={(e) => handleQuarterChange(e.target.value)}
                            className="text-black px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {quarterOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <FavoritesFilter
                        showFavoritesOnly={showFavoritesOnly}
                        onToggle={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        favoritesCount={favorites.length}
                    />
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

            {/* Rankings section with optional sortable headers */}
            <div className="relative">
                {/* Optional: Keep sortable headers if needed */}
                <div className="mb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 text-sm gap-1">
                        <div className="col-span-2 sm:col-span-1">
                            <SortableHeader
                                field="totalPoints"
                                label="Points"
                                bg="stat1"
                                icon="Trophy"
                            />
                        </div>
                        <SortableHeader field="avgScore" label="Power Rating" bg="stat2" icon="Zap" />
                        <SortableHeader field="finalTables" label="Final Tables" bg="stat3" icon="Hexagon" />
                        <SortableHeader field="finalTablePercentage" label="FTP" bg="stat4" icon="LandPlot" />
                        <SortableHeader field="pointsPerGame" label="PPG" bg="stat5" icon="Calculator" />
                    </div>
                </div>

                {/* Player rankings */}
                <div>
                    {sortedAndFilteredRankings.map((player, index) => {
                        const uniqueKey = `${player.uid}-${rankingsData.quarter}-${rankingsData.year}-${index}`;
                        const isQualificationBarrier = player.ranking === 41 && !showFavoritesOnly && !filterText;

                        return (
                            <React.Fragment key={uniqueKey}>
                                {/* Show qualification barrier before 41st place */}
                                {isQualificationBarrier && (
                                    <QualificationBarrier
                                        qualifiedCount={Math.min(40, sortedAndFilteredRankings.length)}
                                        totalPlayers={sortedAndFilteredRankings.length}
                                    />
                                )}
                                <QuarterlyPlayerCard
                                    player={player}
                                    isFavorite={isFavorite(player.uid)}
                                    onToggleFavorite={toggleFavorite}
                                />
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}