// components/PlayerDashboard/PlayerSearch.tsx

import { useEffect, useState } from "react"

interface Player {
    Name: string
    nickname: string | null
    UID: string
    TotalGames?: number
}

interface PlayerSearchProps {
    onPlayerSelect: (player: Player) => void
}

export function PlayerSearch({ onPlayerSelect }: PlayerSearchProps) {
    const [search, setSearch] = useState('')
    const [players, setPlayers] = useState<Player[]>([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
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
                    <div className="absolute w-full mt-1 bg-white rounded-b-lg border border-gray-200 shadow-lg text-black">
                        <ul className="max-h-[300px] overflow-auto">
                            {players.map((player) => (
                                <li
                                    key={player.UID}
                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                    onClick={() => {
                                        onPlayerSelect(player)
                                        setSearch('')
                                    }}
                                >
                                    <div className="font-medium">
                                        {player.nickname || player.Name}
                                    </div>
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