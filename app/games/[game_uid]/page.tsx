// app/games/[fileName]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Trophy, Users, Award, ArrowLeft, Swords } from 'lucide-react'
import Link from 'next/link'
import RotatingImageLoader from '@/components/ui/RotatingImageLoader'

interface Player {
    name: string
    uid: string
    placement: number
    knockouts: number
    hitman: string | null
    totalPoints: number
    startPoints: number
    hitPoints: number
    placementPoints: number
    nickname: string | null
}

interface GameDetails {
    players: Player[]
    venue: string
    date: string
    totalPlayers: number
    totalKnockouts: number
    averagePoints: number
}

// Simpler date formatting function that preserves UTC
function formatGameDate(isoDateString: string): string {
    const date = new Date(isoDateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

export default function GamePage({ params }: { params: { game_uid: string } }) {
    const [gameDetails, setGameDetails] = useState<GameDetails | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchGameDetails() {
            try {
                const response = await fetch(`/api/games/${params.game_uid}`)
                const data = await response.json()
                setGameDetails(data)
            } catch (error) {
                console.error('Failed to fetch game details:', error)
            } finally {
                setLoading(false)
            }
        }

        if (params.game_uid) {
            fetchGameDetails()
        }
    }, [params.game_uid])

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

    if (!gameDetails) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-gray-600">Game not found</div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <Link
                href={`/games`}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Games
            </Link>

            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">{gameDetails.venue}</h1>
                <p className="text-gray-600">
                    {formatGameDate(gameDetails.date)}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="bg-blue-50">
                        <CardTitle className="flex items-center text-blue-900">
                            <Users className="mr-2" />
                            Players
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {gameDetails.totalPlayers}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="bg-gray-50">
                    <CardTitle>Player Results</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="divide-y">
                        {gameDetails.players.map((player, index) => (
                            <div
                                key={player.uid}
                                className="py-4 flex flex-col md:flex-row md:items-center md:justify-between"
                            >
                                <div className="flex items-center gap-4 mb-2 md:mb-0">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                                        ${index === 0 ? 'bg-amber-500 text-white' :
                                            index === 1 ? 'bg-gray-500 text-white' :
                                                index === 2 ? 'bg-orange-500 text-white' :
                                                    'bg-gray-100 text-gray-600'}`}
                                    >
                                        {player.placement}
                                    </div>
                                    <Link
                                        href={`/players?uid=${encodeURIComponent(player.uid)}`}
                                        className="freeroll-link font-medium"
                                    >
                                        {player.nickname || player.name}
                                    </Link>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-black">
                                    <div className="flex items-center">
                                        {player.totalPoints > 0 && (
                                            <>
                                                <Trophy className="w-4 h-4 mr-1 text-blue-500" />
                                                <span>{player.totalPoints} pts</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center">
                                        <Swords className="w-4 h-4 mr-1" />
                                        <span>{player.knockouts} KOs</span>
                                    </div>
                                    {player.hitman && (
                                        <div className="flex items-center text-gray-600">

                                            <span>Eliminated by {player.hitman}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}