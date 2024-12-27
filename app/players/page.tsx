'use client'
import { useState } from 'react'
import { PlayerSearch } from '@/components/PlayerDashboard/PlayerSearch'
import { PlayerDetails } from '@/components/PlayerDashboard/PlayerDetails'

interface Player {
    Name: string
    UID: string
}

export default function PlayersPage() {
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Player Statistics</h1>

            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 mx-auto text-center">Search Player</h2>
                <PlayerSearch
                    onPlayerSelect={(player) => setSelectedPlayer(player)}
                />
            </div>

            {selectedPlayer && (
                <PlayerDetails
                    playerUID={selectedPlayer.UID}
                    playerName={selectedPlayer.Name}
                />
            )}
        </div>
    )
}