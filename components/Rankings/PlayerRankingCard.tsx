// components/Rankings/PlayerRankingCard.tsx

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Trophy, Swords, ChevronLeft, ChevronRight, Hexagon, Zap, Target, LandPlot, Calculator } from 'lucide-react';
import { BadgeData, BadgeGroup } from '../ui/Badge';

interface BasePlayerData {
    name: string;
    uid: string;
    isQualified: boolean;
    nickname: string | null;
    badges?: BadgeData[]; // Add badges to player data
}

interface VenueRanking {
    venue: string;
    rank: number;
    points: number;
}

interface MonthlyPlayer extends BasePlayerData {
    type: 'monthly';
    qualifyingVenues: VenueRanking[];
    bubbleVenues: VenueRanking[];
    isBubble: boolean;
}

interface QuarterlyPlayer extends BasePlayerData {
    type: 'quarterly';
    gamesPlayed: number;
    totalPoints: number;
    totalKnockouts: number;
    finalTables: number;
    avgScore: number;
    finalTablePercentage: number;
    pointsPerGame: number;
    ranking: number;
}

type PlayerData = MonthlyPlayer | QuarterlyPlayer;

interface PlayerRankingCardProps {
    player: PlayerData;
    favoriteButton?: React.ReactNode;
}

export function PlayerRankingCard({ player, favoriteButton }: PlayerRankingCardProps) {
    return (

        <div className={`m-0 bg-white hover:bg-red-800 hover:py-1 transition-all duration-500 overflow-hidden ${player.type === 'monthly' && 'border-y-2 border-red-100'}`}>
            < div className={`border-l-4
        ${player.isQualified ? 'border-l-green-500 bg-green-50' :
                    player.type === 'monthly' && player.isBubble ? 'border-l-yellow-500 bg-yellow-50' :
                        'border-l-rose-500 bg-rose-200'}
      `}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Player Name and Status Section */}
                    <div className="flex-1 min-w-0">


                        <div className="flex items-center gap-2">
                            {player.type === 'quarterly' && (
                                <div className='text-black pt-1 md:p-0'>
                                    <p>{player.ranking}</p>
                                </div>
                            )}
                            <div className="flex items-center gap-2 flex-shrink min-w-0">
                                <Link
                                    href={`/players?uid=${encodeURIComponent(player.uid)}`}
                                    className="freeroll-link text-lg font-medium  truncate"
                                >
                                    {player.nickname || player.name}
                                </Link>
                                {favoriteButton}
                            </div>
                            <div className="flex items-center gap-2">
                                {player.type === 'monthly' && player.isQualified ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <Trophy className="w-4 h-4 mr-1" />
                                        Qualified
                                    </span>
                                ) : player.type === 'monthly' && player.isBubble ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                        Bubble
                                    </span>
                                ) : null}
                                {/* Badges display */}
                                {player.badges && player.badges.length > 0 && (
                                    <div className="ml-2">
                                        <BadgeGroup
                                            badges={player.badges}
                                            size="small"
                                            limit={3}
                                            showName={false}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Details Section */}
                    <div className="flex-1 min-w-0">
                        {player.type === 'monthly' ? (
                            // Monthly Rankings Details
                            <div className="space-y-2">
                                {player.qualifyingVenues.map((venue) => (
                                    <div
                                        key={`${venue.venue}-${player.uid}-${player.name}`}
                                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                                    >
                                        <Link
                                            href={`/venues?venue=${encodeURIComponent(venue.venue)}`}
                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            {venue.venue}
                                        </Link>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded">
                                                #{venue.rank}
                                            </span>
                                            <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-700">
                                                {venue.points} pts
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Quarterly Rankings Details
                            <div className="grid grid-cols-2 sm:grid-cols-6 text-sm">
                                {/* Points */}
                                <div className="flex items-center p-2 bg-green-50">
                                    <Trophy className="w-4 h-4 text-green-600 mr-2 sm:hidden" />
                                    <span className="font-medium text-green-700">{player.totalPoints}</span>
                                </div>
                                {/* Power Rating */}
                                <div className="flex items-center p-2 bg-orange-50">
                                    <Zap className="w-4 h-4 text-orange-600 mr-2 sm:hidden" />
                                    <span className="font-medium text-orange-700">{typeof player.avgScore === 'number' ? player.avgScore.toFixed(2) : '0.00'}</span>
                                </div>
                                {/* Final Tables */}
                                <div className="flex items-center p-2 bg-purple-50">
                                    <Hexagon className="w-4 h-4 text-purple-600 mr-2 sm:hidden" />
                                    <span className="font-medium text-purple-700">{player.finalTables}</span>
                                </div>
                                {/* Final Table Percentage */}
                                <div className="flex items-center p-2 bg-indigo-50">
                                    <LandPlot className="w-4 h-4 text-indigo-600 mr-2 sm:hidden" />
                                    <span className="font-medium text-indigo-700">{typeof player.finalTablePercentage === 'number' ? player.finalTablePercentage.toFixed(1) : '0.0'}%</span>
                                </div>
                                {/* Points Per Game */}
                                <div className="flex items-center p-2 bg-pink-50">
                                    <Calculator className="w-4 h-4 text-pink-600 mr-2 sm:hidden" />
                                    <span className="font-medium text-pink-700">{typeof player.pointsPerGame === 'number' ? player.pointsPerGame.toFixed(1) : '0.0'}</span>
                                </div>
                                {/* Knockouts */}
                                <div className="flex items-center p-2 bg-red-50">
                                    <Swords className="w-4 h-4 text-red-600 mr-2 sm:hidden" />
                                    <span className="font-medium text-red-700">{player.totalKnockouts}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div >
        </div >
    );
}


export function DateToggler({
    isCurrentPeriod,
    setIsCurrentPeriod,
    currentLabel,
    previousLabel
}: {
    isCurrentPeriod: boolean;
    setIsCurrentPeriod: React.Dispatch<React.SetStateAction<boolean>>;
    currentLabel: string;
    previousLabel: string;
}) {
    return (
        <div className="flex gap-2">
            <button
                onClick={() => setIsCurrentPeriod(false)}
                className={`px-4 py-2  flex items-center gap-2 transition-all duration-300 rounded-lg
          ${!isCurrentPeriod
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                    }`}
            >
                <ChevronLeft size={16} className={!isCurrentPeriod ? 'opacity-0' : 'opacity-100'} />
                <span>{previousLabel}</span>
            </button>
            <button
                onClick={() => setIsCurrentPeriod(true)}
                className={`px-4 py-2  flex items-center gap-2 transition-all duration-300 rounded-lg
          ${isCurrentPeriod
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                    }`}
            >
                <span>{currentLabel}</span>
                <ChevronRight size={16} className={isCurrentPeriod ? 'opacity-0' : 'opacity-100'} />
            </button>
        </div>
    );
}