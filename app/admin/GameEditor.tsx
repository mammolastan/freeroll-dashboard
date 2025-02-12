// app/admin/GameEditor.tsx

import React, { useState, useEffect } from 'react';
import { PlayerEditor } from './PlayerEditor';

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

interface GameEditorProps {
    fileName: string;
    onClose: () => void;
}

export function GameEditor({ fileName, onClose }: GameEditorProps) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const response = await fetch(`/api/games/${fileName}/players`);
                if (!response.ok) throw new Error('Failed to fetch players');
                const data = await response.json();
                setPlayers(data.players);
            } catch (err) {
                setError('Failed to load player data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayers();
    }, [fileName]);

    const handlePlayerUpdate = (updatedPlayer: Player) => {
        setPlayers(players.map(p =>
            p.id === updatedPlayer.id ? updatedPlayer : p
        ));
        setEditingPlayer(null);
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Game Details: {fileName}</h3>
                <button
                    onClick={onClose}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                >
                    Back to Games
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border rounded-lg">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placement</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Points</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hitman</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Points</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player Score</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {players.map(player => (
                            <tr key={player.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">{player.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{player.placement}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{player.startPoints}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{player.hitman || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{player.totalPoints}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{player.playerScore}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => setEditingPlayer(player)}
                                        className="text-blue-600 hover:text-blue-900"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingPlayer && (
                <PlayerEditor
                    player={editingPlayer}
                    onSave={handlePlayerUpdate}
                    onCancel={() => setEditingPlayer(null)}
                    totalPlayers={players.length}
                />
            )}
        </div>
    );
}