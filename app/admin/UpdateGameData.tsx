// app/admin/UpdateGameData.tsx

import React, { useState } from 'react'
import { GameEditor } from './GameEditor';

interface GameData {
    id: number;
    fileName: string;
    gameDate: string;
    season: string;
    venue: string;
    game_uid?: string;
    playerCount?: number;
    processedAt?: string;
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York'
    });
};

const formatGameDate = (dateString: string) => {
    // Fix: Handle both date-only strings (YYYY-MM-DD) and full ISO strings
    // For game dates, we want to display the intended date, not the timezone-converted date

    // Validate the input
    if (!dateString) {
        return 'Invalid Date';
    }

    let date: Date;

    if (dateString.includes('T')) {
        // Full ISO string - extract just the date part and treat it as local
        const datePart = dateString.split('T')[0];
        date = new Date(datePart + 'T12:00:00');
    } else {
        // Date-only string, add midday time to avoid timezone shifts
        date = new Date(dateString + 'T12:00:00');
    }

    // Validate the date
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }

    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York'
    });
};

export default function UpdateGameData() {
    const [selectedGames, setSelectedGames] = useState<GameData[]>([]);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [reprocessing, setReprocessing] = useState<string | null>(null);
    const [message, setMessage] = useState<string>('');

    const handleDate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setSelectedFileName(null);
        setMessage('');

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

    const handleReprocess = async (game: GameData) => {
        if (!confirm(`Are you sure you want to reprocess "${game.fileName}" from ${game.venue}? This will delete all existing data for this game and mark it for reprocessing.`)) {
            return;
        }

        setReprocessing(game.fileName);
        setMessage('');

        try {
            // First, we need to get the processed file info for this game
            const processedFileResponse = await fetch(`/api/admin/processed-file-by-game?fileName=${encodeURIComponent(game.fileName)}&gameUid=${encodeURIComponent(game.game_uid || '')}`);

            if (!processedFileResponse.ok) {
                throw new Error('Could not find processed file record for this game');
            }

            const processedFileData = await processedFileResponse.json();

            // Now reprocess using the existing endpoint
            const response = await fetch('/api/admin/reprocess-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileId: processedFileData.id,
                    filename: game.fileName,
                    gameUid: game.game_uid
                }),
            });

            const result = await response.json();

            if (response.ok) {
                setMessage(`Successfully marked "${game.fileName}" for reprocessing. ${result.details}`);
                // Remove the game from the list since it's been reprocessed
                setSelectedGames(prev => prev.filter(g => g.fileName !== game.fileName));
            } else {
                setMessage(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Error reprocessing game:', error);
            setMessage(`Error reprocessing game: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setReprocessing(null);
        }
    };

    return (
        <div className="">
            <div className="">
                <label htmlFor="gameDate" className="">
                    Choose date of game to adjust or reprocess:
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
                        {loading ? 'Loading...' : 'Find Games'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="text-red-500">
                    {error}
                </div>
            )}

            {message && (
                <div className={`mt-4 p-3 rounded ${message.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                    {message}
                </div>
            )}

            {!selectedFileName && selectedGames.length > 0 && (
                <div className="">
                    <h3 className=""> Games on selected date:</h3>
                    <div className="">
                        {selectedGames.map((game) => (
                            <div
                                key={game.fileName}
                                className="clickme border border-gray-300 rounded p-4 mb-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex flex-col gap-3">
                                    <div className="text-lg font-semibold text-gray-800">{game.venue}</div>
                                    <div className="text-sm text-gray-600">
                                        <strong>File:</strong> {game.fileName}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <strong>Season:</strong> {game.season}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                        <div>
                                            <strong>Players:</strong> {game.playerCount || 'Unknown'}
                                        </div>
                                        <div>
                                            <strong>Game Date:</strong> {formatGameDate(game.gameDate)}
                                        </div>
                                        <div className="md:col-span-2">
                                            <strong>Processed:</strong> {game.processedAt ? formatDate(game.processedAt) : 'Unknown'}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                                        <button
                                            onClick={() => setSelectedFileName(game.fileName)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
                                        >
                                            Edit Game Data
                                        </button>
                                        <button
                                            onClick={() => handleReprocess(game)}
                                            disabled={reprocessing === game.fileName}
                                            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${reprocessing === game.fileName
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-orange-600 text-white hover:bg-orange-700'
                                                }`}
                                        >
                                            {reprocessing === game.fileName ? 'Reprocessing...' : 'Reprocess Game'}
                                        </button>
                                    </div>
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