// app/admin/PlayerEditor.tsx

import React, { useState } from 'react';

interface Player {
    id: number;
    name: string;
    placement: number;
    startPoints: number;
    hitman: string | null;
    totalPoints: number;
    playerScore: number;
    uid: string;
}

interface PlayerEditorProps {
    player: Player;
    onSave: (updatedPlayer: Player) => void;
    onCancel: () => void;
    totalPlayers: number;
}

// Calculate points based on placement
function calculatePoints(placement: number, startPoints: number): number {
    let placementPoints = 0;

    if (placement === 1) placementPoints = 10;
    else if (placement <= 8) placementPoints = 9 - placement;

    return startPoints + placementPoints;
}

// Calculate player score
function calculatePlayerScore(placement: number, totalPlayers: number): number {
    return Math.log((totalPlayers + 1) / placement);
}

export function PlayerEditor({ player, onSave, onCancel, totalPlayers }: PlayerEditorProps) {
    const [formData, setFormData] = useState({
        placement: player.placement,
        startPoints: player.startPoints,
        hitman: player.hitman || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Calculate new total points and player score
            const totalPoints = calculatePoints(formData.placement, formData.startPoints);
            const playerScore = calculatePlayerScore(formData.placement, totalPlayers);

            const response = await fetch(`/api/games/player/${player.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    totalPoints,
                    playerScore
                }),
            });

            if (!response.ok) throw new Error('Failed to update player');

            const updatedPlayer = await response.json();
            onSave(updatedPlayer);
        } catch (err) {
            setError('Failed to update player data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-medium mb-4">Edit Player: {player.name}</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Placement
                            <input
                                type="number"
                                value={formData.placement}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    placement: parseInt(e.target.value)
                                })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                min="1"
                                required
                            />
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Start Points
                            <input
                                type="number"
                                value={formData.startPoints}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    startPoints: parseInt(e.target.value)
                                })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                min="0"
                                required
                            />
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Hitman
                            <input
                                type="text"
                                value={formData.hitman}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    hitman: e.target.value
                                })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </label>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}