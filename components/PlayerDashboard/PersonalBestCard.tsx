// components/PlayerDashboard/PersonalBestCard.tsx
import React, { useState, useEffect } from 'react';
import { Trophy, Zap, Hexagon, LandPlot, Star, TrendingUp, Crown } from 'lucide-react';
import RotatingImageLoader from '../ui/RotatingImageLoader';

interface QuarterlyStats {
    quarter: number;
    year: number;
    gamesPlayed: number;
    totalPoints: number;
    finalTables: number;
    finalTablePercentage: number;
    avgScore: number;
    leagueRanking: number;
    totalPlayersInQuarter: number;
}

interface PersonalBests {
    mostFinalTables: QuarterlyStats | null;
    mostTotalPoints: QuarterlyStats | null;
    highestFTP: QuarterlyStats | null;
    highestPowerRating: QuarterlyStats | null;
    bestLeagueRanking: QuarterlyStats | null;
}

interface PersonalBestData {
    personalBests: PersonalBests;
    totalQuarters: number;
}

interface PersonalBestCardProps {
    playerUID: string;
    playerName: string;
}

export function PersonalBestCard({ playerUID, playerName }: PersonalBestCardProps) {
    const [data, setData] = useState<PersonalBestData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const fetchPersonalBests = async () => {
            if (!expanded) return;

            setLoading(true);
            try {
                const response = await fetch(`/api/players/${playerUID}/personal-best`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const personalBestData = await response.json();
                setData(personalBestData);
            } catch (error) {
                console.error('Failed to fetch personal best stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPersonalBests();
    }, [playerUID, expanded]);

    // Helper function to format quarter display
    const formatQuarter = (quarter: number, year: number) => {
        return `Q${quarter} ${year}`;
    };

    // Helper function to get quarter months
    const getQuarterMonths = (quarter: number) => {
        const quarterMonths = {
            1: 'Jan-Mar',
            2: 'Apr-Jun',
            3: 'Jul-Sep',
            4: 'Oct-Dec'
        };
        return quarterMonths[quarter as keyof typeof quarterMonths] || '';
    };

    // Helper function to format ordinal numbers (1st, 2nd, 3rd, etc.)
    const formatOrdinal = (num: number) => {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = num % 100;
        return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    };

    if (!expanded) {
        return (
            <div className="mt-8">
                <button
                    onClick={() => setExpanded(true)}
                    className="w-full py-4 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center hover:bg-amber-200 transition-colors"
                >
                    <Star className="mr-2 h-5 w-5" />
                    Show Personal Best Quarterly Performance
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mt-8 bg-white rounded-xl shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold flex items-center">
                        <Star className="mr-3 h-6 w-6 text-amber-600" />
                        Personal Best Quarterly Performance
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

    if (!data || data.totalQuarters === 0) {
        return (
            <div className="mt-8 bg-white rounded-xl shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold flex items-center">
                        <Star className="mr-3 h-6 w-6 text-amber-600" />
                        Personal Best Quarterly Performance
                    </h2>
                    <button
                        onClick={() => setExpanded(false)}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        Hide
                    </button>
                </div>
                <div className="text-center py-8 text-gray-500">
                    <p>Not enough quarterly data available.</p>
                    <p className="text-sm mt-2">Need at least 3 games in a quarter to track personal bests.</p>
                </div>
            </div>
        );
    }

    const { personalBests, totalQuarters } = data;

    // Personal best stat cards data
    const personalBestStats = [
        {
            title: 'Best League Ranking',
            icon: <Crown className="h-6 w-6" />,
            value: personalBests.bestLeagueRanking ? formatOrdinal(personalBests.bestLeagueRanking.leagueRanking) : 'N/A',
            quarter: personalBests.bestLeagueRanking ? formatQuarter(personalBests.bestLeagueRanking.quarter, personalBests.bestLeagueRanking.year) : null,
            detail: personalBests.bestLeagueRanking ? `Out of ${personalBests.bestLeagueRanking.totalPlayersInQuarter} players` : null,
            bgColor: 'bg-yellow-50',
            textColor: 'text-yellow-900',
            iconColor: 'text-yellow-600'
        },
        {
            title: 'Most Final Tables',
            icon: <Hexagon className="h-6 w-6" />,
            value: personalBests.mostFinalTables?.finalTables || 0,
            quarter: personalBests.mostFinalTables ? formatQuarter(personalBests.mostFinalTables.quarter, personalBests.mostFinalTables.year) : null,
            detail: personalBests.mostFinalTables ? `${personalBests.mostFinalTables.gamesPlayed} games played` : null,
            bgColor: 'bg-purple-50',
            textColor: 'text-purple-900',
            iconColor: 'text-purple-600'
        },
        {
            title: 'Most Total Points',
            icon: <Trophy className="h-6 w-6" />,
            value: personalBests.mostTotalPoints?.totalPoints || 0,
            quarter: personalBests.mostTotalPoints ? formatQuarter(personalBests.mostTotalPoints.quarter, personalBests.mostTotalPoints.year) : null,
            detail: personalBests.mostTotalPoints ? `${personalBests.mostTotalPoints.gamesPlayed} games played` : null,
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-900',
            iconColor: 'text-blue-600'
        },
        {
            title: 'Highest FTP',
            icon: <LandPlot className="h-6 w-6" />,
            value: personalBests.highestFTP ? `${personalBests.highestFTP.finalTablePercentage}%` : '0%',
            quarter: personalBests.highestFTP ? formatQuarter(personalBests.highestFTP.quarter, personalBests.highestFTP.year) : null,
            detail: personalBests.highestFTP ? `${personalBests.highestFTP.finalTables}/${personalBests.highestFTP.gamesPlayed} final tables` : null,
            bgColor: 'bg-green-50',
            textColor: 'text-green-900',
            iconColor: 'text-green-600'
        },
        {
            title: 'Highest Power Rating',
            icon: <Zap className="h-6 w-6" />,
            value: personalBests.highestPowerRating?.avgScore.toFixed(2) || '0.00',
            quarter: personalBests.highestPowerRating ? formatQuarter(personalBests.highestPowerRating.quarter, personalBests.highestPowerRating.year) : null,
            detail: personalBests.highestPowerRating ? `${personalBests.highestPowerRating.gamesPlayed} games played` : null,
            bgColor: 'bg-orange-50',
            textColor: 'text-orange-900',
            iconColor: 'text-orange-600'
        }
    ];

    return (
        <div className="mt-8 bg-white rounded-xl shadow-md">
            <div className="bg-amber-50 p-4 rounded-t-xl border-b border-amber-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-amber-900 flex items-center">
                    <Star className="mr-2 h-5 w-5" />
                    Personal Best Quarterly Performance
                </h2>
                <button
                    onClick={() => setExpanded(false)}
                    className="text-amber-700 hover:text-amber-900"
                >
                    Hide
                </button>
            </div>

            <div className="p-6">
                {/* Summary Info */}
                <div className="mb-6 text-center">
                    <p className="text-gray-600">
                        Based on <span className="font-semibold text-amber-700">{totalQuarters}</span> quarters with 3+ games played
                    </p>
                </div>

                {/* Personal Best Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {personalBestStats.map((stat, index) => (
                        <div
                            key={index}
                            className={`${stat.bgColor} rounded-lg p-4 border border-opacity-20`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className={`${stat.iconColor}`}>
                                    {stat.icon}
                                </div>
                                <TrendingUp className="h-4 w-4 text-gray-400" />
                            </div>

                            <div className="mb-2">
                                <h3 className={`text-sm font-medium ${stat.textColor} mb-1`}>
                                    {stat.title}
                                </h3>
                                <div className={`text-2xl font-bold ${stat.textColor}`}>
                                    {stat.value}
                                </div>
                            </div>

                            {stat.quarter && (
                                <div className="space-y-1">
                                    <div className={`text-xs font-medium ${stat.textColor} bg-white bg-opacity-60 px-2 py-1 rounded`}>
                                        {stat.quarter}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        {getQuarterMonths(stat.quarter ? parseInt(stat.quarter.split(' ')[0].replace('Q', '')) : 1)}
                                    </div>
                                    {stat.detail && (
                                        <div className="text-xs text-gray-500">
                                            {stat.detail}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Additional Info */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 text-center">
                        <strong>Note:</strong> Personal bests are calculated from completed past quarters with at least 3 games played.
                        The current quarter is excluded until it's finished. FTP = Final Table Percentage (reaching top 8 positions).
                    </p>
                </div>
            </div>
        </div>
    );
}