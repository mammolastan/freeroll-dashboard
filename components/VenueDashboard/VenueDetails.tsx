// components/VenueDashboard/VenueDetails.tsx
import { useState, useEffect } from 'react';
import { Trophy, Users, Award, Crown } from 'lucide-react';
import Link from 'next/link';
import RotatingImageLoader from '../ui/RotatingImageLoader';

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
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        async function fetchVenueStats() {

            setLoading(true);
            try {
                const response = await fetch(
                    `/api/venues/${encodeURIComponent(venueName)}/stats?currentMonth=${isCurrentMonth}`
                );
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();

                // Add a small delay for smoother transition
                setTimeout(() => {
                    setStats(data);
                    setLoading(false);
                    setIsTransitioning(false);
                }, 300);
            } catch (error) {
                console.error('Failed to fetch venue stats:', error);
                setStats(null);
                setLoading(false);
                setIsTransitioning(false);
            }
        }

        if (venueName) {
            fetchVenueStats();
        }
    }, [venueName, isCurrentMonth]);

    if (loading && !isTransitioning) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <RotatingImageLoader
                    src="/images/Poker-Chip-Isloated-Blue.png"
                    size="large"
                />
            </div>
        );
    }

    if (!stats?.topPlayers?.length) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
                <Trophy size={48} className="text-gray-400" />
                <div className="text-xl text-gray-600">
                    No stats available for {stats?.month} {stats?.year}
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-8 transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white-800 flex items-center gap-3">
                    <Trophy size={28} className="text-blue-500" />
                    {stats.month} {stats.year} Stats for {venueName}
                </h2>
            </div>

            <div className="bg-white rounded-xl shadow-lg transition-shadow hover:shadow-xl max-w-[800px] mx-auto p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Crown size={24} className="text-amber-500" />
                    <h3 className="text-xl font-bold text-gray-800">Top 10 Players</h3>
                </div>

                <div className="space-y-4">
                    {stats.topPlayers.map((player, index) => (
                        <div
                            key={player.UID}
                            className={`flex items-center justify-between p-4 rounded-lg transition-all duration-300
                                ${index === 0 ? 'bg-amber-50' :
                                    index === 1 ? 'bg-gray-50' :
                                        index === 2 ? 'bg-orange-50' : 'bg-white'}
                                hover:shadow-md border border-gray-100`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center
                                    ${index === 0 ? 'bg-amber-500 text-white' :
                                        index === 1 ? 'bg-gray-500 text-white' :
                                            index === 2 ? 'bg-orange-500 text-white' :
                                                'bg-gray-100 text-gray-600'}`}>
                                    {index + 1}
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-900">
                                        <Link
                                            href={`/players?name=${encodeURIComponent(player.Name)}`}
                                            className="freeroll-link"
                                        >
                                            {player.Name}
                                        </Link>
                                    </div>
                                    <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Users size={16} />
                                            {player.gamesPlayed} games
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Award size={16} />
                                            {player.knockouts} KOs
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Trophy size={16} className="text-blue-500" />
                                <span className="font-bold text-black">
                                    {player.totalPoints} pts
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}