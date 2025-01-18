import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, ChevronLeft, Trophy, Award, Medal } from 'lucide-react';
import Link from 'next/link';

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

    console.log('rankingsData', rankingsData);

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
                <DateToggler isCurrentQuarter={isCurrentQuarter} setIsCurrentQuarter={setIsCurrentQuarter} />
                <div className="text-xl text-gray-600">No players found for this quarter</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold">
                    Quarterly Rankings - Q{rankingsData.quarter} {rankingsData.year}
                </h2>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                <DateToggler
                    isCurrentQuarter={isCurrentQuarter}
                    setIsCurrentQuarter={setIsCurrentQuarter}
                />
                <div className="text-gray-600">
                    {getQuarterLabel(rankingsData.quarter)}
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Games</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">KOs</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Final Tables</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-black">
                                {rankingsData.rankings.map((player) => (
                                    <tr
                                        key={player.uid}
                                        className={`
                      ${player.isQualified ? 'bg-green-50' : ''}
                      hover:bg-opacity-80 transition-colors
                    `}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center">
                                                <span className="font-medium text-black">{player.ranking}</span>
                                                {player.ranking <= 3 && (
                                                    <Medal className={`w-4 h-4 ml-1 ${player.ranking === 1 ? 'text-yellow-500' :
                                                        player.ranking === 2 ? 'text-gray-400' :
                                                            'text-orange-500'
                                                        }`} />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                <Link
                                                    href={`/players?name=${encodeURIComponent(player.name)}`}
                                                    className="text-sm font-medium text-blue-600 freeroll-link"
                                                >
                                                    {player.name}
                                                </Link>
                                                {player.isQualified && (
                                                    <Trophy className="w-4 h-4 text-green-500">
                                                        <title>Qualified for Finals</title>
                                                    </Trophy>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            {player.gamesPlayed}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                                            {player.totalPoints}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            {player.totalKnockouts}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            {player.finalTables}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            {(typeof player.avgScore === 'number' ? player.avgScore.toFixed(2) : String(player.avgScore))}
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

function DateToggler({
    isCurrentQuarter,
    setIsCurrentQuarter
}: {
    isCurrentQuarter: boolean;
    setIsCurrentQuarter: React.Dispatch<React.SetStateAction<boolean>>
}) {
    const currentDate = new Date();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
    const previousQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
    const previousQuarterYear = currentQuarter === 1 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

    return (
        <div className="flex gap-2">
            <button
                onClick={() => setIsCurrentQuarter(false)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300
          ${!isCurrentQuarter
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                    }`}
            >
                <ChevronLeft size={16} className={!isCurrentQuarter ? 'opacity-0' : 'opacity-100'} />
                <span>Q{previousQuarter} {previousQuarterYear}</span>
            </button>
            <button
                onClick={() => setIsCurrentQuarter(true)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300
          ${isCurrentQuarter
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                    }`}
            >
                <span>Q{currentQuarter} {currentDate.getFullYear()}</span>
                <ChevronRight size={16} className={isCurrentQuarter ? 'opacity-0' : 'opacity-100'} />
            </button>
        </div>
    );
}