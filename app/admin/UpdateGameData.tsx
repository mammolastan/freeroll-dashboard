// app/admin/UpdateGameData.tsx

import React, { useState } from 'react'
import { GameEditor } from './GameEditor';

interface GameData {
    id: number;
    fileName: string;
    gameDate: string;
    season: string;
    venue: string;
}

export default function UpdateGameData() {
    const [selectedGames, setSelectedGames] = useState<GameData[]>([]);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleDate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setSelectedFileName(null);

        try {
            const gameDate = (document.getElementById('gameDate') as HTMLInputElement).value;
            if (!gameDate) {
                setError('Please select a date');
                return;
            }

            const response = await fetch(`/api/games/recent/${gameDate}`);
            if (!response.ok) {
                throw new Error('Failed to fetch games');
            }

            const data = await response.json();
            if (data.games) {
                setSelectedGames(data.games);
                if (data.games.length === 0) {
                    setError('No games found for selected date');
                }
            } else {
                setError('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching games:', error);
            setError('Failed to fetch games');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2">
                <label htmlFor="gameDate" className="font-medium">
                    Choose date of game to adjust:
                </label>
                <div className="flex gap-2">
                    <input
                        type="date"
                        id="gameDate"
                        name="gameDate"
                        className="px-3 py-2 border rounded text-black"
                    />
                    <button
                        onClick={handleDate}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-400"
                    >
                        {loading ? 'Loading...' : 'Submit'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="text-red-500">
                    {error}
                </div>
            )}

            {!selectedFileName && selectedGames.length > 0 && (
                <div className="mt-4">
                    <h3 className="font-medium mb-2">Selected games:</h3>
                    <div className="space-y-2">
                        {selectedGames.map((game) => (
                            <div
                                key={game.fileName}
                                className="p-4 border rounded bg-white cursor-pointer hover:bg-gray-50"
                                onClick={() => setSelectedFileName(game.fileName)}
                            >
                                <div className="font-medium">{game.venue}</div>
                                <div className="text-sm text-gray-500">
                                    {game.fileName}
                                </div>
                                <div className="text-sm text-gray-500">
                                    Season: {game.season}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedFileName && (
                <GameEditor
                    fileName={selectedFileName}
                    onClose={() => setSelectedFileName(null)}
                />
            )}
        </div>
    );
}