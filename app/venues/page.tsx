// app/venues/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { VenueDetails } from '@/components/VenueDashboard/VenueDetails'

interface Venue {
    name: string
    totalGames: number
}

interface VenueData {
    venues: Venue[]
    month: string
    year: number
}

export default function VenuesPage() {
    const [venueData, setVenueData] = useState<VenueData | null>(null)
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
    const [loading, setLoading] = useState(true)
    const [isCurrentMonth, setIsCurrentMonth] = useState(true)

    useEffect(() => {
        async function fetchVenues() {
            setLoading(true)
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
                setLoading(false)
            }
        }

        fetchVenues()
    }, [isCurrentMonth])

    if (loading) {
        return <div className="container mx-auto px-4 py-8 text-center">Loading venues...</div>
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {selectedVenue ? (
                <>
                    <button
                        onClick={() => setSelectedVenue(null)}
                        className="mb-6 px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                        ← Back to Venues
                    </button>
                    <DateToggler isCurrentMonth={isCurrentMonth} setIsCurrentMonth={setIsCurrentMonth} />
                    <VenueDetails venueName={selectedVenue.name} isCurrentMonth={isCurrentMonth} />
                </>
            ) : (
                <>
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold">Venue Rankings</h1>

                        <DateToggler isCurrentMonth={isCurrentMonth} setIsCurrentMonth={setIsCurrentMonth} />
                    </div>

                    <h2 className="text-xl text-gray-600 mb-6">
                        {venueData?.month} {venueData?.year}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {venueData?.venues.map((venue) => (
                            <button
                                key={venue.name}
                                onClick={() => setSelectedVenue(venue)}
                                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow
                         flex flex-col items-center text-center border border-gray-100"
                            >
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">{venue.name}</h3>
                                <p className="text-gray-500">
                                    {venue.totalGames} tournament{venue.totalGames !== 1 ? 's' : ''}
                                </p>
                                <div className="mt-4 text-sm text-blue-600">View Rankings →</div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}


function DateToggler({ isCurrentMonth, setIsCurrentMonth }: { isCurrentMonth: boolean, setIsCurrentMonth: React.Dispatch<React.SetStateAction<boolean>> }) {
    return (
        <div className="flex gap-4">
            <button
                onClick={() => setIsCurrentMonth(true)}
                className={`px-4 py-2 rounded-lg ${isCurrentMonth
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
            >
                Current Month
            </button>
            <button
                onClick={() => setIsCurrentMonth(false)}
                className={`px-4 py-2 rounded-lg ${!isCurrentMonth
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
            >
                Previous Month
            </button>
        </div>
    )
}