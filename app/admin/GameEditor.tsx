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
        <div className="">
            <div className="">
                <h3 className="">Game Details: {fileName}</h3>
                <button
                    onClick={onClose}
                    className=""
                >
                    Reset
                </button>
            </div>

            <div className="">
                <table className="">
                    <thead className="">
                        <tr>
                            <th className="">Name</th>
                            <th className="">Placement</th>
                            <th className="">Start Points</th>
                            <th className="">Hitman</th>
                            <th className="">Total Points</th>
                            <th className="">Player Score</th>
                            <th className="">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="">
                        {players.map(player => (
                            <tr key={player.id} className="">
                                <td className="">{player.name}</td>
                                <td className="">{player.placement}</td>
                                <td className="">{player.startPoints}</td>
                                <td className="">{player.hitman || '-'}</td>
                                <td className="">{player.totalPoints}</td>
                                <td className="">{player.playerScore}</td>
                                <td className="">
                                    <button
                                        onClick={() => setEditingPlayer(player)}
                                        className=""
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