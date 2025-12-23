// app/players/page.tsx

'use client'
import { useEffect, useState } from 'react'
import { PlayerSearch } from '@/components/PlayerDashboard/PlayerSearch'
import { PlayerDetails } from '@/components/PlayerDashboard/PlayerDetails'
import { PlayerAvatarModal } from '@/components/ui/PlayerAvatarModal'

interface Player {
    Name: string
    UID: string
    nickname: string | null
    photo_url?: string | null
}

export default function PlayersPage() {
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [selectedRange, setSelectedRange] = useState<string>('current-month');
    const [isClient, setIsClient] = useState(false);
    const [initialRange, setInitialRange] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Single useEffect to handle initialization
    useEffect(() => {
        setIsClient(true);

        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');
        const urlName = urlParams.get('name');
        const urlRange = urlParams.get('range');

        // Set range from URL or localStorage
        if (urlRange) {
            setSelectedRange(urlRange);
            setInitialRange(urlRange);
            localStorage.setItem('selectedRange', urlRange);
        } else {
            const savedRange = localStorage.getItem('selectedRange');
            if (savedRange) {
                setSelectedRange(savedRange);
                setInitialRange(savedRange);
            }
        }

        // If URL has UID, fetch player data using the stats endpoint
        if (urlUid) {

            // First fetch will get minimal player info
            fetch(`/api/players/search?q=${encodeURIComponent(urlUid)}`)
                .then(response => response.json())
                .then(data => {

                    if (data && data.length > 0) {
                        const playerData = {
                            Name: data[0].Name,
                            UID: data[0].UID,
                            nickname: data[0].nickname || null,
                            photo_url: data[0].photo_url || null
                        };
                        setSelectedPlayer(playerData);
                        localStorage.setItem('selectedPlayer', JSON.stringify(playerData));
                    }
                })
                .catch(error => console.error('Error fetching player:', error));
        } else if (urlName) {
            // Handle name-based search
            fetch(`/api/players/search?q=${encodeURIComponent(urlName)}&name=true`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const playerData = {
                            Name: data[0].Name,
                            UID: data[0].UID,
                            nickname: data[0].nickname || null,
                            photo_url: data[0].photo_url || null
                        };
                        setSelectedPlayer(playerData);
                        localStorage.setItem('selectedPlayer', JSON.stringify(playerData));

                        // Update URL with UID
                        const url = new URL(window.location.href);
                        url.searchParams.delete('name');
                        url.searchParams.set('uid', playerData.UID);
                        window.history.replaceState({}, '', url.toString());
                    }
                })
                .catch(error => console.error('Error fetching player:', error));
        }
    }, []);

    const handlePlayerSelect = (player: Player) => {
        setSelectedPlayer(player);
        localStorage.setItem('selectedPlayer', JSON.stringify(player));

        // Update URL with UID
        const url = new URL(window.location.href);
        url.searchParams.set('uid', player.UID);
        window.history.replaceState({}, '', url.toString());
    };

    if (!isClient) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">Player Statistics</h1>
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Search Player</h2>
                    <PlayerSearch onPlayerSelect={handlePlayerSelect} />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Player Statistics</h1>

            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Search Player</h2>
                <PlayerSearch onPlayerSelect={handlePlayerSelect} />
            </div>

            {selectedPlayer && (
                <>
                    {/* Player Profile Header */}
                    <div className="flex items-center gap-6 mb-8 rounded-xl shadow-md p-6 lg:justify-center">
                        {selectedPlayer.photo_url ? (
                            <img
                                src={selectedPlayer.photo_url}
                                alt={selectedPlayer.nickname || selectedPlayer.Name}
                                className="w-24 h-24 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setIsModalOpen(true)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setIsModalOpen(true);
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center ">
                                <span className="text-3xl font-bold text-white">
                                    {(selectedPlayer.nickname || selectedPlayer.Name).charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div>
                            <h2 className="text-3xl font-bold text-white">
                                {selectedPlayer.nickname || selectedPlayer.Name}
                            </h2>
                            {selectedPlayer.nickname && (
                                <p className="text-white text-sm mt-1">
                                    {selectedPlayer.Name}
                                </p>
                            )}
                        </div>
                    </div>

                    <PlayerDetails
                        key={`${selectedPlayer.UID}-${initialRange}`}
                        playerUID={selectedPlayer.UID}
                        playerName={selectedPlayer.nickname || selectedPlayer.Name}
                        initialRange={initialRange}
                    />

                    {/* Avatar Modal */}
                    {selectedPlayer.photo_url && (
                        <PlayerAvatarModal
                            photoUrl={selectedPlayer.photo_url}
                            name={selectedPlayer.nickname || selectedPlayer.Name}
                            isOpen={isModalOpen}
                            onClose={() => setIsModalOpen(false)}
                        />
                    )}
                </>
            )}
        </div>
    );
}