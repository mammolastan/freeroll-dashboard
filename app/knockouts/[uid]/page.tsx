'use client'

import { useState, useEffect } from 'react'
import { formatGameDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Swords, Search } from 'lucide-react'
import RotatingImageLoader from '@/components/ui/RotatingImageLoader'
import { PlayerSearch } from '@/components/PlayerDashboard/PlayerSearch'

interface KnockoutGame {
    date: string
    venue: string
    fileName: string
    player1Placement?: number
    player2Placement?: number
}

interface PlayerStats {
    uid: string
    name: string
    nickname: string | null
    knockouts: KnockoutGame[]
}

interface HeadToHead {
    player: PlayerStats
    comparePlayer: PlayerStats
    gamesPlayed: KnockoutGame[]
}

interface KnockoutPlayer {
    name: string
    uid: string
    nickname: string | null
    count: number
    games: KnockoutGame[]
}

interface KnockoutStats {
    knockedOutBy: KnockoutPlayer[]
    knockedOut: KnockoutPlayer[]
    totalStats: {
        knockedOutCount: number
        knockoutCount: number
    }
    headToHead: HeadToHead | null
}

export default function KnockoutsPage({ params }: { params: { uid: string } }) {
    const [stats, setStats] = useState<KnockoutStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [playerName, setPlayerName] = useState<string>('')
    const [comparePlayer, setComparePlayer] = useState<{ Name: string, UID: string, nickname: string | null } | null>(null)
    const [searchVisible, setSearchVisible] = useState(false)

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true)
            try {
                // Get player name first
                const playerResponse = await fetch(`/api/players/search?q=${params.uid}`)
                const playerData = await playerResponse.json()
                if (playerData && playerData.length > 0) {
                    setPlayerName(playerData[0].nickname || playerData[0].Name)
                }

                // Then fetch knockout stats
                const compareQueryParam = comparePlayer ? `&compareUid=${comparePlayer.UID}` : ''
                const response = await fetch(`/api/players/${params.uid}/knockouts?${compareQueryParam}`)
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
                const data = await response.json()
                setStats(data)
            } catch (error) {
                console.error('Failed to fetch knockout stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [params.uid, comparePlayer])

    const handlePlayerSelect = (player: { Name: string, UID: string, nickname: string | null }) => {
        setComparePlayer(player)
        setSearchVisible(false)
    }

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
            <Link
                href={`/players?uid=${params.uid}`}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Player Profile
            </Link>

            <h1 className="text-3xl font-bold mb-4 flex items-center">
                <Swords className="mr-3 h-8 w-8 text-red-600" />
                Knockout Statistics: {playerName}
            </h1>

            {stats && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Summary Card */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-xl font-bold mb-4">Overall Stats</h2>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <Swords className="h-5 w-5 text-green-600 mr-2" />
                                <span className="font-medium">Knockouts:</span>
                            </div>
                            <span className="text-xl font-bold text-green-600">{stats.totalStats.knockoutCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Swords className="h-5 w-5 text-red-600 mr-2" />
                                <span className="font-medium">Times Knocked Out:</span>
                            </div>
                            <span className="text-xl font-bold text-red-600">{stats.totalStats.knockedOutCount}</span>
                        </div>
                    </div>

                    {/* Player Comparison Search */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-xl font-bold mb-4">Head-to-Head Comparison</h2>
                        {!comparePlayer ? (
                            <div>
                                {searchVisible ? (
                                    <div className="mb-4">
                                        <PlayerSearch onPlayerSelect={handlePlayerSelect} />
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setSearchVisible(true)}
                                        className="w-full py-3 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-colors"
                                    >
                                        <Search className="mr-2 h-5 w-5" />
                                        Search for a player to compare
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-medium">Comparing with: {comparePlayer.nickname || comparePlayer.Name}</span>
                                    <button
                                        onClick={() => setComparePlayer(null)}
                                        className="text-sm text-red-600 hover:text-red-800"
                                    >
                                        Clear
                                    </button>
                                </div>
                                {stats.headToHead && (
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div className="bg-green-50 p-3 rounded-lg">
                                            <div className="font-bold text-2xl text-green-700">{stats.headToHead.player.knockouts.length}</div>
                                            <div className="text-sm text-green-600">Knockouts against</div>
                                        </div>
                                        <div className="bg-red-50 p-3 rounded-lg">
                                            <div className="font-bold text-2xl text-red-700">{stats.headToHead.comparePlayer.knockouts.length}</div>
                                            <div className="text-sm text-red-600">Knockouts by</div>
                                        </div>
                                        <div className="col-span-2 bg-blue-50 p-3 rounded-lg">
                                            <div className="font-bold text-2xl text-blue-700">{stats.headToHead.gamesPlayed.length}</div>
                                            <div className="text-sm text-blue-600">Total games together</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Players Knocked Out By */}
                <div className="bg-white rounded-xl shadow-md">
                    <div className="bg-red-50 p-4 rounded-t-xl border-b border-red-100">
                        <h2 className="font-bold text-xl text-red-900">Knocked Out By</h2>
                        <p className="text-sm text-red-700">Players who have eliminated {playerName}</p>
                    </div>
                    <div className="p-4">
                        {stats?.knockedOutBy.length === 0 ? (
                            <p className="text-gray-500 italic">No knockout data available</p>
                        ) : (
                            <div className="space-y-3">
                                {stats?.knockedOutBy.map((player, index) => (
                                    <div key={player.uid} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 flex items-center justify-center bg-red-100 text-red-800 rounded-full text-sm font-medium">
                                                    {index + 1}
                                                </div>
                                                <Link
                                                    href={`/players?uid=${encodeURIComponent(player.uid)}`}
                                                    className="freeroll-link font-medium"
                                                >
                                                    {player.nickname || player.name}
                                                </Link>
                                            </div>
                                            <div className="text-red-600 font-medium flex items-center gap-1">
                                                <Swords className="h-4 w-4" />
                                                {player.count} time{player.count !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Latest: {formatGameDate(player.games[0].date)} at {player.games[0].venue}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Players Knocked Out */}
                <div className="bg-white rounded-xl shadow-md">
                    <div className="bg-green-50 p-4 rounded-t-xl border-b border-green-100">
                        <h2 className="font-bold text-xl text-green-900">Knocked Out</h2>
                        <p className="text-sm text-green-700">Players eliminated by {playerName}</p>
                    </div>
                    <div className="p-4">
                        {stats?.knockedOut.length === 0 ? (
                            <p className="text-gray-500 italic">No knockout data available</p>
                        ) : (
                            <div className="space-y-3">
                                {stats?.knockedOut.map((player, index) => (
                                    <div key={player.uid} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 flex items-center justify-center bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                                    {index + 1}
                                                </div>
                                                <Link
                                                    href={`/players?uid=${encodeURIComponent(player.uid)}`}
                                                    className="freeroll-link font-medium"
                                                >
                                                    {player.nickname || player.name}
                                                </Link>
                                            </div>
                                            <div className="text-green-600 font-medium flex items-center gap-1">
                                                <Swords className="h-4 w-4" />
                                                {player.count} time{player.count !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Latest: {formatGameDate(player.games[0].date)} at {player.games[0].venue}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Head-to-Head Match History */}
            {stats?.headToHead && (
                <div className="bg-white rounded-xl shadow-md mb-6">
                    <div className="bg-blue-50 p-4 rounded-t-xl border-b border-blue-100">
                        <h2 className="font-bold text-xl text-blue-900">
                            Match History: {playerName} vs. {stats.headToHead.comparePlayer.nickname || stats.headToHead.comparePlayer.name}
                        </h2>
                    </div>
                    <div className="p-4">
                        {stats.headToHead.gamesPlayed.length === 0 ? (
                            <p className="text-gray-500 italic">No games found where both players participated</p>
                        ) : (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Games Played Together</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{playerName} Placement</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{stats.headToHead.comparePlayer.nickname || stats.headToHead.comparePlayer.name} Placement</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {stats.headToHead.gamesPlayed.map((game, index) => {
                                                // Determine knockout status
                                                const p1KnockedOutP2 = stats.headToHead?.player.knockouts.some(
                                                    ko => ko.fileName === game.fileName
                                                );
                                                const p2KnockedOutP1 = stats.headToHead?.comparePlayer.knockouts.some(
                                                    ko => ko.fileName === game.fileName
                                                );

                                                let outcome;
                                                if (p1KnockedOutP2) {
                                                    outcome = (
                                                        <span className="text-green-600 font-medium flex items-center">
                                                            <Swords className="h-4 w-4 mr-1" />
                                                            {playerName} knocked out opponent
                                                        </span>
                                                    );
                                                } else if (p2KnockedOutP1) {
                                                    outcome = (
                                                        <span className="text-red-600 font-medium flex items-center">
                                                            <Swords className="h-4 w-4 mr-1" />
                                                            Opponent knocked out {playerName}
                                                        </span>
                                                    );
                                                } else if (game.player1Placement && game.player2Placement) {
                                                    outcome = game.player1Placement < game.player2Placement ?
                                                        <span className="text-blue-600">Better placement</span> :
                                                        <span className="text-orange-600">Worse placement</span>;
                                                } else {
                                                    outcome = <span className="text-gray-500">No direct encounter</span>;
                                                }

                                                return (
                                                    <tr key={`${game.fileName}-${index}`}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatGameDate(game.date)}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{game.venue}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{game.player1Placement || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{game.player2Placement || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{outcome}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}