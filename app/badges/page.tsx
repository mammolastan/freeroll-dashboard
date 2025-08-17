// app/badges/page.tsx

'use client'

import React, { useState, useEffect } from 'react';
import './badges.css';
import BadgeModal from './BadgeModal';

interface Badge {
    badge_id: string;
    name: string;
    short_description: string;
    long_description: string;
    icon: string;
    rarity: string;
    category: string;
    tier?: string;
    criteria: string;
    quote: string;
    created_at: string;
    updated_at: string;
    rarityNum: number;
}


// Helper functions
const getRarityInfo = (rarity: string | number) => {
    let rarityNum: number;

    if (typeof rarity === 'string') {
        rarityNum = parseInt(rarity);
    } else {
        rarityNum = rarity;
    }

    if (rarityNum >= 99) return { text: 'Legendary', className: 'legendary', color: '#8b5cf6' };
    if (rarityNum >= 70) return { text: 'Rare', className: 'rare', color: '#ef4444' };
    if (rarityNum >= 33) return { text: 'Uncommon', className: 'uncommon', color: '#fffb00' };
    return { text: 'Common', className: 'common', color: '#10b981' };
};

export default function BadgeLegendPage() {
    const [badges, setBadges] = useState<Badge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
    const [hoveredBadge, setHoveredBadge] = useState<Badge | null>(null);
    const [filterCategory, setFilterCategory] = useState<string>('all');

    // Get unique categories from badges
    const categories = ['all', ...Array.from(new Set(badges.map(badge => badge.category)))];

    useEffect(() => {
        async function fetchBadges() {
            try {
                const response = await fetch('/api/badges/all');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || 'Failed to fetch badges');
                }
                const data = await response.json();
                console.log('Fetched badges:', data);
                setBadges(data);
            } catch (error) {
                console.error('Error fetching badges:', error);
                setError(error instanceof Error ? error.message : 'Failed to fetch badges');
            } finally {
                setLoading(false);
            }
        }

        fetchBadges();
    }, []);

    const handleBadgeClick = (badge: Badge) => {
        setSelectedBadge(badge);
    };

    const closeModal = () => {
        setSelectedBadge(null);
    };

    // Filter badges by category
    const filteredBadges = filterCategory === 'all'
        ? badges
        : badges.filter(badge => badge.category === filterCategory);

    if (loading) {
        return (
            <div className="page-loading">
                <div className="loading-text">Loading badges...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-error">
                <div className="error-content">
                    <div className="error-title">Error loading badges</div>
                    <div className="error-message">{error}</div>
                    <button
                        onClick={() => window.location.reload()}
                        className="retry-button"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (badges.length === 0) {
        return (
            <div className="page-empty">
                <div className="empty-content">
                    <div className="empty-title">No badges found</div>
                    <div className="empty-message">Check that badges exist in your database and are enabled</div>
                </div>
            </div>
        );
    }

    return (
        <div className="badges-page">
            <div className="badges-container">
                {/* Header */}
                <div className="page-header">
                    <h1 className="page-title">Achievement Badges</h1>

                </div>


                {/* Badge Grid */}
                <div className="badges-grid-container">
                    <div className="badges-grid">
                        {filteredBadges.map((badge) => {
                            const rarityInfo = getRarityInfo(badge.rarityNum);
                            const isHovered = hoveredBadge?.badge_id === badge.badge_id;

                            return (
                                <div
                                    key={badge.badge_id}
                                    className="badge-item"
                                    onMouseEnter={() => setHoveredBadge(badge)}
                                    onMouseLeave={() => setHoveredBadge(null)}
                                >
                                    {/* Badge Container */}
                                    <div
                                        className={`badge-container ${isHovered ? 'hovered' : ''}`}
                                        onClick={() => handleBadgeClick(badge)}
                                    >
                                        {/* Badge Image */}
                                        <div className="badge-image-wrapper">
                                            <img
                                                src={`/images/badges/${badge.icon}`}
                                                alt={badge.short_description}
                                                className="badge-image"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/images/badges/default.svg';
                                                }}
                                            />
                                        </div>

                                        {/* Rarity Glow Effect */}
                                        <div
                                            className="badge-glow"
                                            style={{
                                                boxShadow: `0 0 20px ${rarityInfo.color}`,
                                                background: `radial-gradient(circle, ${rarityInfo.color}20 0%, transparent 70%)`
                                            }}
                                        />



                                        {/* Rarity Corner Indicator */}
                                        <div
                                            className="badge-rarity-dot"
                                            style={{ backgroundColor: rarityInfo.color }}
                                            title={rarityInfo.text}
                                        />
                                    </div>

                                    {/* Hover Tooltip */}
                                    {isHovered && (
                                        <div className="badge-tooltip">
                                            <div className="tooltip-content">
                                                <div className="tooltip-title">{badge.short_description}</div>
                                                <div className="tooltip-rarity">{rarityInfo.text}</div>
                                                <div className="tooltip-category">{badge.category}</div>
                                                <div className="tooltip-arrow"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="badges-legend">
                        <div className="legend-item">
                            <div className="legend-dot common-dot"></div>
                            <span>Common</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-dot uncommon-dot"></div>
                            <span>Uncommon</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-dot rare-dot"></div>
                            <span>Rare </span>
                        </div>


                    </div>


                </div>

                {/* Modal */}
                {selectedBadge && (
                    <BadgeModal
                        closeModal={closeModal}
                        selectedBadge={selectedBadge}
                        getRarityInfo={getRarityInfo}
                    />
                )}
            </div>
        </div>
    );
}