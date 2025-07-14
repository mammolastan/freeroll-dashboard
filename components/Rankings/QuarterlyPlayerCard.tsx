// components/Rankings/QuarterlyPlayerCard.tsx

import React from 'react';
import Link from 'next/link';
import { Trophy, Zap, Hexagon, LandPlot, Calculator, User } from 'lucide-react';
import { BadgeData, BadgeGroup } from '../ui/Badge';
import './PlayerRankingCard.css';

interface QuarterlyPlayer {
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
    badges?: BadgeData[];
}

interface QuarterlyPlayerCardProps {
    player: QuarterlyPlayer;
    isFavorite?: boolean;
    onToggleFavorite?: (uid: string) => void;
}

export function QuarterlyPlayerCard({ player, isFavorite, onToggleFavorite }: QuarterlyPlayerCardProps) {
    const displayName = player.nickname || player.name;

    // Stats for the grid (Power Rating, Final Tables, FTP, PPG)
    const gridStats = [
        {
            icon: <Zap className="statIcon" />,
            value: typeof player.avgScore === 'number' ? player.avgScore.toFixed(2) : '0.00',
            label: 'Power'
        },
        {
            icon: <Hexagon className="statIcon" />,
            value: player.finalTables.toString(),
            label: 'FT'
        },
        {
            icon: <LandPlot className="statIcon" />,
            value: typeof player.finalTablePercentage === 'number' ? `${player.finalTablePercentage.toFixed(1)}%` : '0.0%',
            label: 'FTP'
        },
        {
            icon: <Calculator className="statIcon" />,
            value: typeof player.pointsPerGame === 'number' ? player.pointsPerGame.toFixed(1) : '0.0',
            label: 'PPG'
        }
    ];

    const handleRankingClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onToggleFavorite) {
            onToggleFavorite(player.uid);
        }
    };

    return (
        <div className={`playerCardContainer ${player.isQualified ? 'qualified' : ''}`}>
            {/* Ranking Badge - now clickable for favorites */}
            <div
                className={`ranking ${isFavorite ? 'favorited' : ''}`}
                onClick={handleRankingClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRankingClick(e as any);
                    }
                }}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
                <p className="rank">{player.ranking}</p>
            </div>

            {/* Profile Picture Placeholder */}
            <div className="profilePicture">
                <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    backgroundColor: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #fff',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                    <User size={24} color="#9ca3af" />
                </div>
            </div>

            {/* Player Info */}
            <div className="infoContainer">
                <div className="name">
                    <Link
                        href={`/players?uid=${encodeURIComponent(player.uid)}`}
                        className="freeroll-link"
                    >
                        <p className="playerName" title={displayName}>
                            {displayName}
                        </p>
                    </Link>
                </div>

                {/* Badges */}
                {player.badges && player.badges.length > 0 && (
                    <div className="badges">
                        <BadgeGroup
                            badges={player.badges}
                            size="small"
                            limit={7}
                            showName={false}
                        />
                    </div>
                )}
            </div>

            {/* Stats Container */}
            <div className="statsContainer">
                {/* Main Stat - Total Points */}
                <div className="mainStat">
                    <Trophy className="mainStatIcon" color="#1f2937" />
                    <p className="statMain">{player.totalPoints || 0}</p>
                </div>

                {/* Stats Grid */}
                <div className="statGrid">
                    {gridStats.map((stat, index) => (
                        <div key={index} className="statGridItem">
                            {stat.icon}
                            <p className="statValue">{stat.value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}