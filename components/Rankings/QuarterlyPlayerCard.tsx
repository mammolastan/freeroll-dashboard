// components/Rankings/QuarterlyPlayerCard.tsx

import React from 'react';
import Link from 'next/link';
import { Trophy, Swords, Hexagon, Zap, LandPlot, Calculator } from 'lucide-react';
import { BadgeData, BadgeGroup } from '../ui/Badge';

interface QuarterlyPlayerData {
    name: string;
    uid: string;
    isQualified: boolean;
    nickname: string | null;
    badges?: BadgeData[];
    gamesPlayed: number;
    totalPoints: number;
    totalKnockouts: number;
    finalTables: number;
    avgScore: number;
    finalTablePercentage: number;
    pointsPerGame: number;
    ranking: number;
}

interface QuarterlyPlayerCardProps {
    player: QuarterlyPlayerData;
    favoriteButton?: React.ReactNode;
}

export function QuarterlyPlayerCard({ player, favoriteButton }: QuarterlyPlayerCardProps) {
    return (
        <div className="m-0 bg-white hover:bg-red-800 hover:py-1 transition-all duration-500 overflow-hidden">
            <div className={`border-l-4 ${player.isQualified
                    ? 'border-l-green-500 bg-green-50'
                    : 'border-l-rose-500 bg-rose-200'
                }`}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Player Name and Ranking Section */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <div className='text-black pt-1 md:p-0'>
                                <p>{player.ranking}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink min-w-0">
                                <Link
                                    href={`/players?uid=${encodeURIComponent(player.uid)}`}
                                    className="freeroll-link text-lg font-medium truncate"
                                >
                                    {player.nickname || player.name}
                                </Link>
                                {favoriteButton}
                            </div>
                            <div className="flex items-center gap-2">
                                {player.isQualified && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <Trophy className="w-4 h-4 mr-1" />
                                        Qualified
                                    </span>
                                )}

                                {/* Badges display */}
                                {player.badges && player.badges.length > 0 && (
                                    <div className="ml-2">
                                        <BadgeGroup
                                            badges={player.badges}
                                            size="small"
                                            limit={5}
                                            showName={false}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-2 sm:grid-cols-6 text-sm">
                            {/* Points */}
                            <div className="flex items-center p-2 bg-green-50">
                                <Trophy className="w-4 h-4 text-green-600 mr-2 sm:hidden" />
                                <span className="font-medium text-green-700">
                                    {player.totalPoints ? player.totalPoints : 0}
                                </span>
                            </div>

                            {/* Power Rating */}
                            <div className="flex items-center p-2 bg-orange-50">
                                <Zap className="w-4 h-4 text-orange-600 mr-2 sm:hidden" />
                                <span className="font-medium text-orange-700">
                                    {typeof player.avgScore === 'number' ? player.avgScore.toFixed(2) : '0.00'}
                                </span>
                            </div>

                            {/* Final Tables */}
                            <div className="flex items-center p-2 bg-purple-50">
                                <Hexagon className="w-4 h-4 text-purple-600 mr-2 sm:hidden" />
                                <span className="font-medium text-purple-700">{player.finalTables}</span>
                            </div>

                            {/* Final Table Percentage */}
                            <div className="flex items-center p-2 bg-indigo-50">
                                <LandPlot className="w-4 h-4 text-indigo-600 mr-2 sm:hidden" />
                                <span className="font-medium text-indigo-700">
                                    {typeof player.finalTablePercentage === 'number'
                                        ? player.finalTablePercentage.toFixed(1)
                                        : '0.0'
                                    }%
                                </span>
                            </div>

                            {/* Points Per Game */}
                            <div className="flex items-center p-2 bg-pink-50">
                                <Calculator className="w-4 h-4 text-pink-600 mr-2 sm:hidden" />
                                <span className="font-medium text-pink-700">
                                    {typeof player.pointsPerGame === 'number'
                                        ? player.pointsPerGame.toFixed(1)
                                        : '0.0'
                                    }
                                </span>
                            </div>

                            {/* Knockouts */}
                            <div className="flex items-center p-2 bg-red-50">
                                <Swords className="w-4 h-4 text-red-600 mr-2 sm:hidden" />
                                <span className="font-medium text-red-700">{player.totalKnockouts}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}