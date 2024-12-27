import * as React from 'react'
import { NextResponse } from "next/server";
import { GET } from '@/app/api/players/search/route';

interface Player {
    Name: string
    UID: string
    TotalGames?: number
}

interface PlayerSearchProps {
    onPlayerSelect: (player: Player) => void
}

// Separate async function to get IP
async function getIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error fetching IP:', error);
        return null;
    }
}

export function PlayerSearch({ onPlayerSelect }: PlayerSearchProps) {
    const [search, setSearch] = React.useState('')
    const [players, setPlayers] = React.useState<Player[]>([])
    const [isLoading, setIsLoading] = React.useState(false)

    React.useEffect(() => {
        if (!search) {
            setPlayers([])
            return
        }

        const timer = setTimeout(async () => {
            setIsLoading(true)
            try {
                // Fetch players
                const response = await fetch(`/api/players/search?q=${search}`)
                const data = await response.json()
                setPlayers(data)
                // Get and log IP
                const ip = await getIP();
                console.log("Current IP Address:", ip);
            } catch (error) {
                console.error('Failed to fetch players:', error)
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [search])

    return (
        <div className="w-full max-w-sm mx-auto">
            <div className="relative">
                <input
                    type="search"
                    placeholder="Search for a player..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-red-900
                    hover:bg-blue-900
                    focus:bg-blue-900
                    active:bg-blue-900
                    caret-purple-500
                    transition-colors
                    duration-1000
                    w-full
                    px-4
                    py-2
                    rounded-lg
                    border
                    border-transparent
                    focus:outline-none
                    focus:ring-2
                    focus:ring-pink-500
                    text-white
                    placeholder-white-100
                    focus:animate-pulse-ring
                    font-medium"
                />

                {isLoading && (
                    <div className="mt-2 text-sm text-gray-500">Loading...</div>
                )}

                {players.length > 0 && (
                    <div className="absolute
                    w-full
                    mt-1
                    bg-white
                    rounded-b-lg
                    border
                    border-gray-200
                    shadow-lg
                    text-black">
                        <ul className="max-h-[300px] overflow-auto">
                            {players.map((player) => (
                                <li
                                    key={player.UID}
                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                    onClick={() => {
                                        onPlayerSelect(player)
                                        setSearch('') // Clear the search input after selection
                                    }}
                                >
                                    <div className="font-medium">{player.Name}</div>
                                    {player.TotalGames && (
                                        <div className="text-sm text-gray-500">
                                            {player.TotalGames} games played
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}