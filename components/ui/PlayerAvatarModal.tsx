// components/ui/PlayerAvatarModal.tsx

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface PlayerAvatarModalProps {
    photoUrl: string;
    name: string;
    isOpen: boolean;
    onClose: () => void;
}

export function PlayerAvatarModal({ photoUrl, name, isOpen, onClose }: PlayerAvatarModalProps) {
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

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fadeIn"
            onClick={handleBackdropClick}
        >
            <div
                className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all"
                    aria-label="Close"
                >
                    <X size={24} />
                </button>

                {/* Image */}
                <div className="flex items-center justify-center p-8 min-h-[400px]">
                    <img
                        src={photoUrl}
                        alt={name}
                        className="rounded-lg"
                        style={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '70vh',
                            objectFit: 'contain',
                            borderRadius: '0.5rem'
                        }}
                    />
                </div>

                {/* Name footer */}
                <div className="bg-gray-100 px-6 py-4 text-center">
                    <p className="text-lg font-semibold text-gray-800">{name}</p>
                </div>
            </div>
        </div>
    );
}
