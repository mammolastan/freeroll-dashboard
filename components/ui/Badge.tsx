// Updated Badge.tsx component
import React, { useState } from 'react';
import { BadgeModal } from './BadgeModal';

export interface BadgeData {
    id: string;
    quote: string;
    criteria: string;
    short_description: string;
    long_description: string;
    icon: string;
    rarity: number;
    earned_at: string;
    expiration?: string | null;
    description?: string | null;
    tier?: string | null;
}

interface BadgeProps {
    badge: BadgeData;
    size?: 'small' | 'medium' | 'large';
    showName?: boolean;
}

// Helper function to check if badge is expired
const isBadgeExpired = (expiration: string | null | undefined): boolean => {
    if (!expiration) return false;
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
const sortBadgesByrarity = (badges: BadgeData[]): BadgeData[] => {
    return [...badges].sort((a, b) => {
        if (b.rarity !== a.rarity) {
            return b.rarity - a.rarity;
        }
        return new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime();
    });
};

export function Badge({ badge, size = 'medium', showName = false }: BadgeProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const sizeClasses = {
        small: 'w-8 h-8',
        medium: 'w-12 h-12',
        large: 'w-16 h-16'
    };

    // Don't render expired badges
    if (isBadgeExpired(badge.expiration)) {
        return null;
    }

    const isExpiringSoon = isBadgeExpiringSoon(badge.expiration);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsModalOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsModalOpen(true);
        }
    };

    return (
        <>
            <div className="inline-flex flex-col items-center mr-1">
                <div
                    className={`${sizeClasses[size]} overflow-hidden transition-transform hover:scale-110 cursor-pointer relative`}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${badge.short_description} achievement`}
                >
                    <div className="relative w-full h-full">
                        <img
                            alt={badge.short_description}
                            src={`/images/badges/${badge.icon}`}
                            className="w-full h-full object-contain"
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

            <BadgeModal
                badge={badge}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
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
    const sortedBadges = sortBadgesByrarity(validBadges);

    const displayBadges = limit > 0 ? sortedBadges.slice(0, limit) : sortedBadges;
    const hasMoreBadges = limit > 0 && sortedBadges.length > limit;

    return (
        <div className="items-center gap-1 flex-wrap">
            {displayBadges.map(badge => (
                <Badge
                    key={badge.id}
                    badge={badge}
                    size={size}
                    showName={showName}
                />
            ))}

            {hasMoreBadges && (
                <div className={`
                    flex items-center justify-center rounded-full bg-gray-200 text-gray-700 font-semibold cursor-pointer hover:bg-gray-300 transition-colors
                    ${size === 'small' ? 'w-8 h-8 text-xs' : size === 'medium' ? 'w-12 h-12 text-sm' : 'w-16 h-16 text-base'}
                `}>
                    +{sortedBadges.length - limit}
                </div>
            )}
        </div>
    );
}