// components/ui/BadgeModal.tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { BadgeData } from './Badge';
import './BadgeModal.css';
import { get } from 'http';

interface BadgeModalProps {
    badge: BadgeData;
    isOpen: boolean;
    onClose: () => void;
}

export function BadgeModal({ badge, isOpen, onClose }: BadgeModalProps) {
    // Handle escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getRarityInfo = (rarity: number) => {
        if (rarity > 99) return { text: 'Legendary', className: 'legendary' };
        if (rarity > 66) return { text: 'Rare', className: 'rare' };
        if (rarity > 33) return { text: 'Uncommon', className: 'uncommon' };
        return { text: 'Common', className: 'common' };
    };

    const rarityInfo = getRarityInfo(badge.rarity);
    const isExpiringSoon = badge.expiration &&
        new Date(badge.expiration) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
        new Date(badge.expiration) >= new Date();

    return (
        <div
            className={`badge-modal-overlay ${getRarityInfo(badge.rarity).className}`}
            onClick={handleBackdropClick}
        >
            <div
                className="badge-modal-container"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="badge-modal-header">
                    <h2 className="badge-modal-title">{badge.short_description}</h2>
                    {/* Tier display - only show if tier exists */}
                    {badge.tier && (
                        <div className={`badge-modal-tier${!badge.tier.includes('1') ? ' shimmer' : ''}${badge.tier.includes('3') ? ' enhanced-shimmer' : ''}`}>
                            {badge.tier}
                        </div>
                    )}
                    <p>{badge.criteria}</p>

                </div>

                {/* Content */}
                <div className="badge-modal-content">
                    {/* Badge Icon */}
                    <div className="badge-modal-icon-section">
                        <div className="badge-modal-icon">
                            <img
                                src={`/images/badges/${badge.icon}`}
                                alt={badge.short_description}
                            />
                        </div>

                        {/* Rarity Badge */}
                        <span className={`badge-modal-rarity ${rarityInfo.className}`}>
                            {rarityInfo.text}
                        </span>
                    </div>

                    {/* Description */}
                    <div className="badge-modal-description-section">


                        {/* Custom achievement description */}
                        {badge.description && (
                            <div className="badge-modal-achievement-box">
                                <p className="badge-modal-achievement-text">
                                    {badge.description}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Achievement Details */}
                    <div className="badge-modal-details-section">
                        <div className="badge-modal-detail-row">
                            <span className="badge-modal-detail-label">Earned</span>
                            <span className="badge-modal-detail-value">
                                {formatDate(badge.earned_at)}
                            </span>
                        </div>

                        {badge.expiration && (
                            <div className="badge-modal-detail-row">
                                <span className="badge-modal-detail-label">Expires</span>
                                <span className={`badge-modal-detail-value ${isExpiringSoon ? 'expiring' : ''}`}>
                                    {isExpiringSoon && '⚠️ '}
                                    {formatDate(badge.expiration)}
                                </span>
                            </div>
                        )}

                    </div>

                </div>

                {/* Footer */}
                <div className="badge-modal-footer">
                    <button
                        onClick={onClose}
                        className="badge-modal-footer-btn"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}