// components/Rankings/MonthlyPlayerCard.tsx

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Trophy } from 'lucide-react';
import { BadgeData, BadgeGroup } from '../ui/Badge';

interface VenueRanking {
    venue: string;
    rank: number;
    points: number;
}

interface MonthlyPlayerData {
    name: string;
    uid: string;
    isQualified: boolean;
    nickname: string | null;
    badges?: BadgeData[];
    qualifyingVenues: VenueRanking[];
    bubbleVenues: VenueRanking[];
    isBubble: boolean;
}

interface MonthlyPlayerCardProps {
    player: MonthlyPlayerData;
    favoriteButton?: React.ReactNode;
}

export function MonthlyPlayerCard({ player, favoriteButton }: MonthlyPlayerCardProps) {
    return (
        <div className={`m-0 bg-white hover:bg-red-800 hover:py-1 transition-all duration-500 overflow-hidden border-y-2 border-red-100`}>
            <div className={`border-l-4 ${player.isQualified
                    ? 'border-l-green-500 bg-green-50'
                    : player.isBubble
                        ? 'border-l-yellow-500 bg-yellow-50'
                        : 'border-l-rose-500 bg-rose-200'
                }`}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Player Name and Status Section */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
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
                                {player.isQualified ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <Trophy className="w-4 h-4 mr-1" />
                                        Qualified
                                    </span>
                                ) : player.isBubble ? (
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
                                            limit={5}
                                            showName={false}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Venue Details Section */}
                    <div className="flex-1 min-w-0">
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
                    </div>
                </div>
            </div>
        </div>
    );
}