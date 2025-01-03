// app/venues/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { VenueDetails } from '@/components/VenueDashboard/VenueDetails'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface Venue {
    name: string;
    totalGames: number;
    topPlayers: Player[];
}

interface VenueData {
    venues: Venue[]
    month: string
    year: number
}

interface Player {
    name: string;
    uid: string;
    totalPoints: number;
    knockouts: number;
    gamesPlayed: number;
}

export default function VenuesPage() {
    const [venueData, setVenueData] = useState<VenueData | null>(null)
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
    const [loading, setLoading] = useState(true)
    const [isCurrentMonth, setIsCurrentMonth] = useState(true)
    const [isTransitioning, setIsTransitioning] = useState(false)

    useEffect(() => {
        async function fetchVenues() {
            setIsTransitioning(true)
            try {
                const response = await fetch(`/api/venues/list?currentMonth=${isCurrentMonth}`)
                const data = await response.json()
                if (data.venues) {
                    setVenueData(data)

                    // Check URL for venue parameter
                    const urlParams = new URLSearchParams(window.location.search);
                    const venueParam = urlParams.get('venue');
                    if (venueParam) {
                        const venue: Venue | undefined = data.venues.find((v: Venue) => v.name === venueParam);
                        if (venue) {
                            setSelectedVenue(venue);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch venues:', error)
                setVenueData(null)
            } finally {
                // Add a small delay before removing loading state for smoother transition
                setTimeout(() => {
                    setLoading(false)
                    setIsTransitioning(false)
                }, 300)
            }
        }

        fetchVenues()
    }, [isCurrentMonth])

    if (loading && !isTransitioning) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-gray-600 animate-pulse">Loading venues...</div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col">
            <div className="flex-grow">
                {selectedVenue ? (
                    <>
                        <Link
                            onClick={() => setSelectedVenue(null)}
                            href="/venues"
                            className="mb-6 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2 transition-colors"
                        >
                            <ChevronLeft size={16} />
                            <span>Back to Venues</span>
                        </Link>
                        <div className="flex justify-center mb-6">
                            <DateToggler isCurrentMonth={isCurrentMonth} setIsCurrentMonth={setIsCurrentMonth} />
                        </div>
                        <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                            <VenueDetails venueName={selectedVenue.name} isCurrentMonth={isCurrentMonth} />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                            <h1 className="text-3xl font-bold">Venue Rankings</h1>
                            <DateToggler isCurrentMonth={isCurrentMonth} setIsCurrentMonth={setIsCurrentMonth} />
                        </div>

                        <h2 className="text-xl text-gray-600 mb-6">
                            {venueData?.month} {venueData?.year}
                        </h2>

                        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                            {venueData?.venues.length === 0 ? (
                                <p className="text-center text-lg">
                                    No games found for this month.
                                </p>
                            ) : (
                                venueData?.venues.map((venue) => (
                                    <div
                                        key={venue.name}
                                        className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden"
                                    >
                                        <div
                                            onClick={() => setSelectedVenue(venue)}
                                            className="cursor-pointer p-6 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-xl font-semibold text-gray-800">{venue.name}</h3>
                                                <ChevronRight size={16} className="text-gray-400" />
                                            </div>
                                            <p className="text-gray-500 mt-1">
                                                {venue.totalGames} tournament{venue.totalGames !== 1 ? 's' : ''}
                                            </p>
                                        </div>

                                        <div className="p-4">
                                            <h4 className="text-sm font-medium text-gray-600 mb-3">Top Players</h4>
                                            <div className="space-y-3">
                                                {venue.topPlayers.map((player, index) => (
                                                    <div key={player.uid} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm
                                        ${index === 0 ? 'bg-amber-500 text-white' :
                                                                    index === 1 ? 'bg-gray-400 text-white' :
                                                                        index === 2 ? 'bg-orange-600 text-white' :
                                                                            'bg-gray-100 text-gray-600'}`}
                                                            >
                                                                {index + 1}
                                                            </div>
                                                            <Link
                                                                href={`/players?name=${encodeURIComponent(player.name)}`}
                                                                className="freeroll-link text-sm font-medium text-blue-600"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {player.name}
                                                            </Link>
                                                        </div>
                                                        <div className="text-sm text-gray-600">
                                                            {player.totalPoints} pts
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

function DateToggler({ isCurrentMonth, setIsCurrentMonth }: {
    isCurrentMonth: boolean,
    setIsCurrentMonth: React.Dispatch<React.SetStateAction<boolean>>
}) {
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const previousDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
    const previousMonth = previousDate.toLocaleString('default', { month: 'long' });

    return (
        <div className="flex gap-2">
            <button
                onClick={() => setIsCurrentMonth(false)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300
                    ${!isCurrentMonth
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                    }`}
            >
                <ChevronLeft size={16} className={!isCurrentMonth ? 'opacity-0' : 'opacity-100'} />
                <span>{previousMonth}</span>
            </button>
            <button
                onClick={() => setIsCurrentMonth(true)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300
                                ${isCurrentMonth
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                    }`}
            >
                <span>{currentMonth}</span>
                <ChevronRight size={16} className={isCurrentMonth ? 'opacity-0' : 'opacity-100'} />
            </button>
        </div>
    )
}