// components/VenueDashboard/VenueDetails.tsx
import { useState, useEffect } from 'react';

interface VenueStats {
    topPlayers: Array<{
        Name: string;
        UID: string;
        gamesPlayed: number;
        totalPoints: number;
        knockouts: number;
    }>;
    month: string;
    year: number;
}

interface VenueDetailsProps {
    venueName: string;
    isCurrentMonth?: boolean;
}

export function VenueDetails({ venueName, isCurrentMonth = true }: VenueDetailsProps) {
    const [stats, setStats] = useState<VenueStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchVenueStats() {
            setLoading(true);
            try {
                const response = await fetch(
                    `/api/venues/${encodeURIComponent(venueName)}/stats?currentMonth=${isCurrentMonth}`
                );
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch venue stats:', error);
                setStats(null);
            } finally {
                setLoading(false);
            }
        }

        if (venueName) {
            fetchVenueStats();
        }
    }, [venueName, isCurrentMonth]);

    if (loading) {
        return <div className="text-center py-12 text-gray-600 animate-pulse">Loading stats...</div>;
    }

    if (!stats?.topPlayers?.length) {
        return <div className="text-center py-12 text-gray-600">No stats available for {stats?.month} {stats?.year}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white-800">
                    {stats.month} {stats.year} Stats for {venueName}
                </h2>
            </div>

            <div className="bg-white rounded-xl shadow-md max-w-[600px] p-6">
                <h3 className="text-lg text-black font-semibold mb-4">Top 10 Players</h3>
                <div className="space-y-4">
                    {stats.topPlayers.map((player, index) => (
                        <div
                            key={player.UID}
                            className="flex items-center justify-between border-b border-gray-100 last:border-0 pb-3 last:pb-0"
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-lg font-bold text-black">{index + 1}</span>
                                <div>
                                    <div className="font-medium text-black">{player.Name}</div>
                                    <div className="text-sm text-gray-500">
                                        Games: {player.gamesPlayed} • KOs: {player.knockouts}
                                    </div>
                                </div>
                            </div>
                            <div className="font-semibold text-blue-600">
                                {player.totalPoints} pts
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}