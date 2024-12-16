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

async function GET_IP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return NextResponse.json({ ip: data.ip });
    } catch (err) {
        // Type assertion to handle the unknown error type
        const error = err as Error;
        return NextResponse.json({ error: error.message }, { status: 500 });
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
                const response = await fetch(`/api/players/search?q=${search}`)
                const data = await response.json()
                setPlayers(data)
                console.log("GET_IP");
                console.log(GET_IP());
            } catch (error) {
                console.error('Failed to fetch players:', error)
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [search])

    return (
        <div className="w-full max-w-sm">
            <div className="relative">
                <input
                    type="search"
                    placeholder="Search for a player..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />

                {isLoading && (
                    <div className="mt-2 text-sm text-gray-500">Loading...</div>
                )}

                {players.length > 0 && (
                    <div className="absolute w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg text-black">
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