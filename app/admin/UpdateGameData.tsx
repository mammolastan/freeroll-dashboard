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
        <div className="">
            <div className="">
                <label htmlFor="gameDate" className="">
                    Choose date of game to adjust:
                </label>
                <div className="">
                    <input
                        type="date"
                        id="gameDate"
                        name="gameDate"
                        className=""
                    />
                    <button
                        onClick={handleDate}
                        disabled={loading}
                        className=""
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
                <div className="">
                    <h3 className=""> Games on selected date:</h3>
                    <div className="">
                        {selectedGames.map((game) => (
                            <div
                                key={game.fileName}
                                className="clickme"
                                onClick={() => setSelectedFileName(game.fileName)}
                            >
                                <div className="">{game.venue}</div>
                                <div className="">
                                    {game.fileName}
                                </div>
                                <div className="">
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