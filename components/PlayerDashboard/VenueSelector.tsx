// components/PlayerDashboard/VenueSelector.tsx

import React from 'react';

interface VenueSelectorProps {
    venues: string[];
    selectedVenue: string;
    onVenueChange: (venue: string) => void;
}

export function VenueSelector({ venues, selectedVenue, onVenueChange }: VenueSelectorProps) {
    return (
        <select
            value={selectedVenue}
            onChange={(e) => onVenueChange(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white 
                text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <option value="all">All Venues</option>
            {venues.map(venue => (
                <option key={venue} value={venue}>{venue}</option>
            ))}
        </select>
    );
}

export default VenueSelector;