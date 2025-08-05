// app/admin/RecentBadgesAwarded.tsx
'use client'

import React, { useState, useEffect } from 'react';

interface RecentBadge {
    id: number;
    player_uid: string;
    earned_at: string;
    badge_description: string | null;
    name: string;
    nickname: string | null;
    short_description: string;
    icon: string;
    rarity: number;
}

export default function RecentBadgesAwarded() {
    const [badges, setBadges] = useState<RecentBadge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRecentBadges();
    }, []);

    const fetchRecentBadges = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/recent-badges');
            if (!response.ok) {
                throw new Error('Failed to fetch recent badges');
            }
            const data = await response.json();
            setBadges(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };


    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <div className="text-white">Loading recent badges...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500 bg-red-100 p-4 rounded">
                Error: {error}
                <button
                    onClick={fetchRecentBadges}
                    className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">25 Most Recent Badge Awards</h3>
                <button
                    onClick={fetchRecentBadges}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                    Refresh
                </button>
            </div>

            {badges.length === 0 ? (
                <div className="text-white text-center py-8">
                    No recent badges found.
                </div>
            ) : (
                <table className="w-full border-collapse border border-gray-300 bg-white">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-300 px-3 py-2 text-left text-black">Badge</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-black">Player</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-black">Badge Name</th>

                            <th className="border border-gray-300 px-3 py-2 text-left text-black">Earned Date</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-black">Achievement Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {badges.map((badge, index) => (
                            <tr key={badge.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="border border-gray-300 px-3 py-2">
                                    <div className="flex items-center">
                                        <img
                                            src={`/images/badges/${badge.icon}`}
                                            alt={badge.short_description}
                                            className="w-8 h-8 mr-2"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/images/badges/default.svg';
                                            }}
                                        />
                                    </div>
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-black">
                                    <a
                                        href={`/players?uid=${encodeURIComponent(badge.player_uid)}`}
                                        className="text-white-600 hover:text-blue-800 underline"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {badge.nickname || badge.name}
                                    </a>
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-black font-medium">
                                    {badge.short_description}
                                </td>

                                <td className="border border-gray-300 px-3 py-2 text-black text-sm">
                                    {formatDate(badge.earned_at)}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-black text-sm">
                                    {badge.badge_description || 'No details provided'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <div className="mt-4 text-sm text-gray-300">
                Last updated: {new Date().toLocaleString()}
            </div>
        </div>
    );
}