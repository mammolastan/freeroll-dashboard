// app/badges/BadgeModal.tsx

import React from 'react'

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

interface BadgeModalProps {
    closeModal: () => void;
    selectedBadge: Badge;
    getRarityInfo: (rarityNum: number) => { text: string; className: string; color: string };
}


export default function BadgeModal({
    closeModal,
    selectedBadge,
    getRarityInfo
}: BadgeModalProps) {
    return (
        <div className="modal-overlay" onClick={closeModal}>
            <div className={`modal-content ${getRarityInfo(selectedBadge.rarityNum).className}`} onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="modal-header">

                    <h2 className="modal-title">
                        {selectedBadge.short_description}
                    </h2>
                    {/* Large Badge Image */}
                    <div className="modal-badge-container">
                        <div className="modal-badge-image">
                            <img
                                src={`/images/badges/${selectedBadge.icon}`}
                                alt={selectedBadge.short_description}
                                className="modal-badge-img"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/images/badges/default.svg';
                                }}
                            />
                        </div>

                        {/* Tier indicator for modal */}
                        {selectedBadge.tier && (
                            <div className="modal-badge-tier">
                                {selectedBadge.tier}
                            </div>
                        )}
                    </div>



                    {/* Rarity Badge */}
                    <div className="modal-rarity">
                        <span className="modal-rarity-text">
                            {getRarityInfo(selectedBadge.rarityNum).text}
                        </span>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="modal-body">


                    {/* Badge Details */}
                    <div className="modal-section details-section">


                        {/* Quote */}
                        {selectedBadge.quote && (

                            <p className="quote-text">{selectedBadge.quote}</p>

                        )}

                        {/* Description */}
                        {selectedBadge.long_description && (
                            <p className="section-text">{selectedBadge.long_description}</p>
                        )}
                        <h3 className="section-title">How to earn</h3>
                        <p className="section-text">{selectedBadge.criteria}</p>

                    </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer">
                    <button
                        onClick={closeModal}
                        className="modal-footer-button"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
