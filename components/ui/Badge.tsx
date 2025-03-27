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

export function Badge({ badge, size = 'medium', showName = false }: BadgeProps) {
    const sizeClasses = {
        small: 'w-8 h-8',
        medium: 'w-12 h-12',
        large: 'w-16 h-16'
    };

    const getIconPath = (iconName: string) => {
        // Default to a path format, can be updated based on your icon structure
        // return `/images/badges/default.svg`;
        return `/images/badges/${iconName}`;
    };

    const tooltipContent = (
        <div>
            <h3 className="font-bold">{badge.short_description}</h3>
            <p className="text-sm mt-1">{badge.long_description}</p>
            <div className="text-xs mt-2 text-gray-500">
                {/* <span className="capitalize">{badge.rarity}</span> • Earned {formatDate(badge.earned_at)} */}
            </div>
        </div>
    )

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <TooltipProvider delayDuration={300} skipDelayDuration={0}>

            <MobileTooltipTrigger content={tooltipContent}>
                <div className="inline-flex flex-col items-center mr-1">
                    <div
                        className={`${sizeClasses[size]} overflow-hidden transition-transform hover:scale-110`}
                    >
                        <div className="relative w-full h-full">

                            <img alt={badge.name} src={`${getIconPath(badge.icon)}`} width={`${size === 'small' ? '32px' : size === 'medium' ? '48px' : '64px'}`} />

                        </div>
                    </div>
                    {showName && (
                        <span className="text-xs mt-1 text-center max-w-[80px]">{badge.short_description}</span>
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
    const displayBadges = limit > 0 ? badges.slice(0, limit) : badges;
    const hasMoreBadges = limit > 0 && badges.length > limit;

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
                                    +{badges.length - limit}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                {badges.length - limit} more badge{badges.length - limit !== 1 ? 's' : ''}
                            </TooltipContent>
                        </TooltipRoot>
                    </TooltipProvider>
                )}
            </div>
        </>
    );
}