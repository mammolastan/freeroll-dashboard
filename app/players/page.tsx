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
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
    const [isClient, setIsClient] = useState(false);
    const [initialRange, setInitialRange] = useState<string | null>(() => {
        // Initialize from URL parameter immediately
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('range');
        }
        return null;
    });
    // Handle client-side initialization
    useEffect(() => {
        setIsClient(true);
        const urlParams = new URLSearchParams(window.location.search);
        const range = urlParams.get('range');
        const playerName = urlParams.get('name');



        if (range) {
            setInitialRange(range);
        }

        if (playerName) {
            fetch(`/api/players/search?q=${encodeURIComponent(playerName)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.length > 0) {
                        const player = data.find((p: Player) => p.Name === playerName) || data[0];
                        setSelectedPlayer(player);
                    }
                })
                .catch(error => console.error('Error fetching player:', error));
        }
    }, []);

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