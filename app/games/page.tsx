// app/games/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Trophy, Users, ChevronRight, UtensilsCrossed } from 'lucide-react'
import RotatingImageLoader from '@/components/ui/RotatingImageLoader'
import { formatGameDateET } from "@/lib/utils";
import PlayerAvatar from '@/components/ui/PlayerAvatar'

interface TopPlayer {
    name: string
    points: number
    knockouts: number
    UID: string
    nickname: string
    photo_url: string | null
}

interface Game {
    fileName: string
    venue: string
    date: string
    totalPlayers: number
    topThree: TopPlayer[]
    totalKnockouts: number
    game_uid: string
}

//Helper function to format the timestamp
function formatFetchTimestamp(isoString: string | null): string {
    if (!isoString) return 'No data';

    return new Date(isoString).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

export default function GamesPage() {
    const [games, setGames] = useState<Game[]>([])
    const [fetchTimestamp, setFetchTimestamp] = useState<string | null>(null);
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchRecentGames() {
            try {
                const response = await fetch('/api/games/recent');
                const data = await response.json();
                setGames(data.games);
                setFetchTimestamp(data.fetchTimestamp);
            } catch (error) {
                console.error('Failed to fetch recent games:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchRecentGames();
    }, []);


    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <RotatingImageLoader
                    src="/images/Poker-Chip-Isloated-Blue.png"
                    size="large"
                />
            </div>
        )
    }
    
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Recent Games</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map((game) => (
                    <Card
                        key={game.fileName}
                        className="hover:shadow-lg transition-shadow duration-300"
                    >
                        <CardHeader className="bg-blue-50">
                            <CardTitle className="text-xl font-semibold text-blue-900">
                                {game.venue}
                            </CardTitle>
                            <p className="text-sm text-gray-600">
                                {formatGameDateET(game.date)}
                            </p>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    {game.topThree.map((player, index) => (
                                        <div key={index} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center
                                                    ${index === 0 ? 'bg-amber-500 text-white' :
                                                        index === 1 ? 'bg-gray-400 text-white' :
                                                            'bg-orange-600 text-white'}`}
                                                >
                                                    {index + 1}
                                                </div>
                                                {player.photo_url && (
                                                    <PlayerAvatar
                                                        photoUrl={player.photo_url}
                                                        name={player.nickname || player.name}
                                                        size="sm"
                                                        showFallback={false}
                                                    />
                                                )}
                                                <Link
                                                    href={`/players?uid=${encodeURIComponent(player.UID)}`}
                                                    className="freeroll-link font-medium text-blue-600"
                                                >
                                                    {player.nickname || player.name}
                                                </Link>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1 text-black">
                                                    <Trophy size={14} className="text-green-500" />
                                                    {player.points}
                                                </span>
                                                <span className="flex items-center gap-1 text-black">
                                                    <UtensilsCrossed size={14} className="text-red-500" />
                                                    {player.knockouts}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <Users size={16} className="text-blue-500" />
                                        <span className="text-gray-600">Players:</span>
                                        <span className="font-medium text-black">{game.totalPlayers}</span>
                                    </div>
                                </div>
                            </div>

                            <Link
                                href={`/games/${encodeURIComponent(game.game_uid)}`}
                                className="mt-4 text-sm text-blue-600 flex items-center justify-end gap-1"
                            >
                                Full game details
                                <ChevronRight size={16} />
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {/* Timestamp display */}
            <div className="text-xs text-gray-400 select-none">
                Data fetched: {formatFetchTimestamp(fetchTimestamp)}
            </div>
        </div>
    )
}