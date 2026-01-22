// components/ui/PlayerAvatarModal.tsx

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Link from 'next/link';
import './PlayerAvatarModal.css';

interface PlayerAvatarModalProps {
    photoUrl: string;
    name: string;
    uid?: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export function PlayerAvatarModal({ photoUrl, name, uid, isOpen, onClose }: PlayerAvatarModalProps) {
    // Handle escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
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

    const modalContent = (
        <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999] p-4 animate-fadeIn"
            onClick={handleBackdropClick}
        >
            <div
                className="relative w-full px-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 z-10 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-all backdrop-blur-sm"
                    aria-label="Close"
                >
                    <X size={24} />
                </button>

                {/* Glass Frame Container */}
                <div className="glass-frame">
                    {/* Corner accents */}
                    <div className="glass-corner glass-corner-tl" />
                    <div className="glass-corner glass-corner-tr" />
                    <div className="glass-corner glass-corner-bl" />
                    <div className="glass-corner glass-corner-br" />

                    {/* Top reflection */}
                    <div className="glass-reflection" />

                    {/* Image container with sheen effect */}
                    {uid ? (
                        <Link href={`/players?uid=${encodeURIComponent(uid)}`} className="glass-image-container block">
                            <img
                                src={photoUrl}
                                alt={name}
                                className="glass-image"
                            />
                            {/* Moving sheen overlay */}
                            <div className="glass-sheen" />
                            {/* Inner glow */}
                            <div className="glass-inner-glow" />
                        </Link>
                    ) : (
                        <div className="glass-image-container">
                            <img
                                src={photoUrl}
                                alt={name}
                                className="glass-image"
                            />
                            {/* Moving sheen overlay */}
                            <div className="glass-sheen" />
                            {/* Inner glow */}
                            <div className="glass-inner-glow" />
                        </div>
                    )}
                </div>

                {/* Name footer - styled to match the glass theme */}
                <div className="mt-4 text-center">
                    {uid ? (
                        <Link
                            href={`/players?uid=${encodeURIComponent(uid)}`}
                            className="text-xl font-semibold text-white drop-shadow-lg hover:text-cyan-300 transition-colors"
                        >
                            {name}
                        </Link>
                    ) : (
                        <p className="text-xl font-semibold text-white drop-shadow-lg">
                            {name}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}