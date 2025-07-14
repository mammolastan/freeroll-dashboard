// components/Rankings/FavoritesComponents.tsx

import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

// Custom hook for managing favorites
export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        // Load favorites from localStorage on component mount
        const savedFavorites = localStorage.getItem('playerFavorites');
        if (savedFavorites) {
            setFavorites(JSON.parse(savedFavorites));
        }
    }, []);

    const toggleFavorite = (uid: string) => {
        setFavorites(prev => {
            const newFavorites = prev.includes(uid)
                ? prev.filter(id => id !== uid) //remove player from favorites
                : [...prev, uid]; // add player to favorites

            // Save to localStorage
            localStorage.setItem('playerFavorites', JSON.stringify(newFavorites));
            return newFavorites;
        });
    };

    const isFavorite = (uid: string) => favorites.includes(uid);

    return { favorites, toggleFavorite, isFavorite };
}

// Star button component
export function FavoriteButton({
    uid,
    isFavorite,
    onToggle
}: {
    uid: string;
    isFavorite: boolean;
    onToggle: (uid: string) => void;
}) {
    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle(uid);
            }}
            className={`transition-all duration-200 
                ${isFavorite
                    ? 'text-yellow-500 hover:text-yellow-600'
                    : 'text-gray-400 hover:text-yellow-500'}`}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
            <Star
                size={18}
                className={`transition-all duration-200 
                    ${isFavorite ? 'fill-yellow-500' : 'fill-transparent'}`}
            />
        </button>
    );
}

// Filter toggle for favorites
export function FavoritesFilter({
    showFavoritesOnly,
    onToggle,
    favoritesCount
}: {
    showFavoritesOnly: boolean;
    onToggle: () => void;
    favoritesCount: number;
}) {
    return (
        <button
            onClick={onToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                ${showFavoritesOnly
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
            <Star size={16} className={showFavoritesOnly ? 'fill-white' : ''} />
            <span>Favorites ({favoritesCount})</span>
        </button>
    );
}