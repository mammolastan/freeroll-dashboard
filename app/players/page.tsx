// app/players/page.tsx

'use client'
import { useEffect, useState } from 'react'
import { PlayerSearch } from '@/components/PlayerDashboard/PlayerSearch'
import { PlayerDetails } from '@/components/PlayerDashboard/PlayerDetails'

interface Player {
    Name: string
    UID: string
}

export default function PlayersPage() {
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('selectedPlayer');
            return saved ? JSON.parse(saved) : null;
        }
        return null;
    });
    const [selectedRange, setSelectedRange] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('selectedRange') || 'current-month';
        }
        return 'current-month';
    });
    const [isClient, setIsClient] = useState(false);
    const [initialRange, setInitialRange] = useState<string | null>(() => {
        // Initialize from URL parameter immediately
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('range');
        }
        return null;
    });


    useEffect(() => {
        setIsClient(true);
        const urlParams = new URLSearchParams(window.location.search);
        const range = urlParams.get('range');
        const playerName = urlParams.get('name');

        // URL params take precedence over localStorage
        if (range) {
            setSelectedRange(range);
            localStorage.setItem('selectedRange', range);
        } else {
            const savedRange = localStorage.getItem('selectedRange');
            if (savedRange) setInitialRange(savedRange);
        }

        // Fetch player if name provided
        if (playerName) {
            fetch(`/api/players/search?q=${encodeURIComponent(playerName)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.length > 0) {
                        const player = data.find((p: Player) => p.Name === playerName) || data[0];
                        setSelectedPlayer(player);
                        localStorage.setItem('selectedPlayer', JSON.stringify(player));
                    }
                });
        }
    }, []);

    // Update localStorage when player changes
    useEffect(() => {
        if (selectedPlayer) {
            localStorage.setItem('selectedPlayer', JSON.stringify(selectedPlayer));
        }
    }, [selectedPlayer]);


    // Update localStorage when range changes
    useEffect(() => {
        localStorage.setItem('selectedRange', selectedRange);
    }, [selectedRange]);

    // Don't render URL-dependent content until client-side
    if (!isClient) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">Player Statistics</h1>
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Search Player</h2>
                    <PlayerSearch
                        onPlayerSelect={(player) => setSelectedPlayer(player)}
                    />
                </div>
            </div>
        );
    }


    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Player Statistics</h1>

            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Search Player</h2>
                <PlayerSearch
                    onPlayerSelect={(player) => setSelectedPlayer(player)}
                />
            </div>

            {selectedPlayer && (
                <PlayerDetails
                    key={`${selectedPlayer.UID}-${initialRange}`}
                    playerUID={selectedPlayer.UID}
                    playerName={selectedPlayer.Name}
                    initialRange={initialRange}
                />
            )}
        </div>
    );
}