// components/ui/Badge.tsx
import React from 'react';
import { TooltipProvider, MobileTooltipTrigger, TooltipRoot, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import Image from 'next/image';

export interface BadgeData {
    id: string;
    name: string;
    short_description: string;
    long_description: string;
    icon: string;
    rarity: number;
    earned_at: string;
    expiration?: string | null; // Add expiration field
}

interface BadgeProps {
    badge: BadgeData;
    size?: 'small' | 'medium' | 'large';
    showName?: boolean;
}

const rarityColors = (rarity: number) => {
    if (rarity < 33) return 'bg-gray-200 border-gray-400';
    if (rarity >= 33 && rarity <= 66) return 'bg-green-100 border-green-500';
    if (rarity > 66 && rarity <= 99) return 'bg-blue-100 border-blue-500';
    return 'bg-purple-100 border-purple-500';
};

// Helper function to check if badge is expired
const isBadgeExpired = (expiration: string | null | undefined): boolean => {
    if (!expiration) return false; // No expiration means it doesn't expire
    const now = new Date();
    const expirationDate = new Date(expiration);
    return expirationDate < now;
};

// Helper function to check if badge is expiring soon (within 30 days)
const isBadgeExpiringSoon = (expiration: string | null | undefined): boolean => {
    if (!expiration) return false;
    const now = new Date();
    const expirationDate = new Date(expiration);
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    return expirationDate <= thirtyDaysFromNow && expirationDate >= now;
};

// Helper function to sort badges by rarity (highest first)
const sortBadgesByRarity = (badges: BadgeData[]): BadgeData[] => {
    return [...badges].sort((a, b) => {
        // Sort by rarity descending (highest rarity first)
        if (b.rarity !== a.rarity) {
            return b.rarity - a.rarity;
        }
        // If rarity is the same, sort by earned_at descending (most recent first)
        return new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime();
    });
};

export function Badge({ badge, size = 'medium', showName = false }: BadgeProps) {
    const sizeClasses = {
        small: 'w-8 h-8',
        medium: 'w-12 h-12',
        large: 'w-16 h-16'
    };

    const getIconPath = (iconName: string) => {
        return `/images/badges/${iconName}`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Don't render expired badges
    if (isBadgeExpired(badge.expiration)) {
        return null;
    }

    const isExpiringSoon = isBadgeExpiringSoon(badge.expiration);

    const tooltipContent = (
        <div>
            <h3 className="font-bold">{badge.short_description}</h3>
            <p className="text-sm mt-1">{badge.long_description}</p>
            <div className="text-xs mt-2 text-gray-500">
                <div>{badge.rarity > 99 ? (
                    <span className="text-purple-600">Legendary</span>
                ) : badge.rarity > 66 ? (
                    <span className="text-red-600">Rare</span>
                ) : badge.rarity > 33 ? (
                    <span className="text-yellow-600">Uncommon</span>
                ) : (
                    <span className="text-green-600">Common</span>
                )}</div>
                <div>Earned {formatDate(badge.earned_at)}</div>
                {badge.expiration && (
                    <div className={isExpiringSoon ? 'text-yellow-400 font-medium' : ''}>
                        {isExpiringSoon ? '⚠️ ' : ''}
                        Expires {formatDate(badge.expiration)}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <TooltipProvider delayDuration={300} skipDelayDuration={0}>
            <MobileTooltipTrigger content={tooltipContent}>
                <div className="inline-flex flex-col items-center mr-1">
                    <div
                        className={`${sizeClasses[size]} overflow-hidden transition-transform hover:scale-110 relative`}
                    >
                        <div className="relative w-full h-full">
                            <img
                                alt={badge.name}
                                src={`${getIconPath(badge.icon)}`}
                                width={`${size === 'small' ? '32px' : size === 'medium' ? '48px' : '64px'}`}
                            />

                            {/* Expiring soon indicator */}
                            {isExpiringSoon && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-600 rounded-full animate-pulse" />
                            )}
                        </div>
                    </div>
                    {showName && (
                        <span className={`text-xs mt-1 text-center max-w-[80px] ${isExpiringSoon ? 'text-yellow-600' : ''}`}>
                            {badge.short_description}
                        </span>
                    )}
                </div>
            </MobileTooltipTrigger>
        </TooltipProvider>
    );
}

export function BadgeGroup({ badges, size = 'medium', limit = 0, showName = true }: {
    badges: BadgeData[];
    size?: 'small' | 'medium' | 'large';
    limit?: number;
    showName?: boolean;
}) {
    // Filter out expired badges first
    const validBadges = badges.filter(badge => !isBadgeExpired(badge.expiration));

    // Sort badges by rarity (highest first), then by earned_at (most recent first)
    const sortedBadges = sortBadgesByRarity(validBadges);

    const displayBadges = limit > 0 ? sortedBadges.slice(0, limit) : sortedBadges;
    const hasMoreBadges = limit > 0 && sortedBadges.length > limit;

    return (
        <>
            <div className="items-center gap-1 text-center">
                {displayBadges.map(badge => (
                    <Badge
                        key={badge.id}
                        badge={badge}
                        size={size}
                        showName={showName}
                    />
                ))}

                {hasMoreBadges && (
                    <TooltipProvider>
                        <TooltipRoot>
                            <TooltipTrigger asChild>
                                <div className={`
                flex items-center justify-center rounded-full bg-gray-200 text-gray-700 font-semibold
                ${size === 'small' ? 'w-8 h-8 text-xs' : size === 'medium' ? 'w-12 h-12 text-sm' : 'w-16 h-16 text-base'}
              `}>
                                    +{sortedBadges.length - limit}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                {sortedBadges.length - limit} more badge{sortedBadges.length - limit !== 1 ? 's' : ''}
                            </TooltipContent>
                        </TooltipRoot>
                    </TooltipProvider>
                )}
            </div>
        </>
    );
}