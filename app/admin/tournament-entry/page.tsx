'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Download, Copy, Save, RotateCcw } from 'lucide-react';

interface Player {
    id: string;
    name: string;
    hitman: string;
    koPosition: number | null;
}

interface TournamentData {
    name: string;
    date: string;
    director: string;
    players: Player[];
}

interface HitmanDropdownProps {
    playerId: string;
    currentValue: string;
    playerNames: string[];
    onSelect: (playerId: string, hitman: string) => void;
}

function HitmanDropdown({ playerId, currentValue, playerNames, onSelect }: HitmanDropdownProps) {
    const [inputValue, setInputValue] = useState(currentValue);
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredNames, setFilteredNames] = useState<string[]>([]);

    useEffect(() => {
        setInputValue(currentValue);
    }, [currentValue]);

    useEffect(() => {
        if (inputValue.length >= 1) {
            const filtered = playerNames.filter(name =>
                name.toLowerCase().includes(inputValue.toLowerCase()) && name !== inputValue
            );
            setFilteredNames(filtered);
            setShowDropdown(filtered.length > 0);
        } else {
            setShowDropdown(false);
            setFilteredNames([]);
        }
    }, [inputValue, playerNames]);

    const handleInputChange = (value: string) => {
        setInputValue(value);
        onSelect(playerId, value);
    };

    const handleSelectName = (name: string) => {
        setInputValue(name);
        onSelect(playerId, name);
        setShowDropdown(false);
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => inputValue.length >= 1 && setShowDropdown(filteredNames.length > 0)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="w-full px-2 py-1 border rounded text-black"
                placeholder="Who knocked them out?"
            />
            {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-32 overflow-y-auto">
                    {filteredNames.map((name, index) => (
                        <div
                            key={index}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-black"
                            onMouseDown={() => handleSelectName(name)}
                        >
                            {name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TournamentEntryPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [tournamentData, setTournamentData] = useState<TournamentData>({
        name: '',
        date: new Date().toISOString().split('T')[0],
        director: '',
        players: []
    });
    const [newPlayerName, setNewPlayerName] = useState('');
    const [saveStatus, setSaveStatus] = useState('');

    // Load data from localStorage on component mount
    useEffect(() => {
        const savedData = localStorage.getItem('tournamentData');
        console.log('Loading from localStorage:', savedData); // Debug log
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                console.log('Parsed data:', parsed); // Debug log
                setTournamentData(parsed);
            } catch (error) {
                console.error('Error loading saved tournament data:', error);
            }
        }
    }, []);

    // Save data to localStorage whenever tournamentData changes
    useEffect(() => {
        // Don't save empty initial state
        if (tournamentData.name || tournamentData.director || tournamentData.players.length > 0) {
            console.log('Saving to localStorage:', tournamentData); // Debug log
            localStorage.setItem('tournamentData', JSON.stringify(tournamentData));
        }
    }, [tournamentData]);

    const handleLogin = async (e: any) => {
        if (e.key === 'Enter' || e.type === 'click') {
            console.log("Logging in with password:", password);
            const response = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            setIsAuthenticated(data.authenticated);
        }
    };

    const addPlayer = () => {
        if (!newPlayerName.trim()) return;

        const newPlayer: Player = {
            id: Date.now().toString(),
            name: newPlayerName.trim(),
            hitman: '',
            koPosition: null
        };

        setTournamentData(prev => ({
            ...prev,
            players: [...prev.players, newPlayer]
        }));

        setNewPlayerName('');
    };

    const updatePlayer = (id: string, field: keyof Player, value: string | number) => {
        setTournamentData(prev => {
            const updatedPlayers = prev.players.map(player => {
                if (player.id === id) {
                    const updatedPlayer = {
                        ...player,
                        [field]: field === 'koPosition' ? (value === '' ? null : Number(value)) : value
                    };

                    // Auto-increment KO position when hitman is set and KO position is empty
                    if (field === 'hitman' && value && !updatedPlayer.koPosition) {
                        const maxKoPosition = prev.players
                            .filter(p => p.koPosition !== null)
                            .reduce((max, p) => Math.max(max, p.koPosition!), 0);
                        updatedPlayer.koPosition = maxKoPosition + 1;
                    }

                    return updatedPlayer;
                }
                return player;
            });

            return {
                ...prev,
                players: updatedPlayers
            };
        });
    };

    const handleHitmanSelect = (playerId: string, hitman: string) => {
        updatePlayer(playerId, 'hitman', hitman);
    };

    const removePlayer = (id: string) => {
        setTournamentData(prev => ({
            ...prev,
            players: prev.players.filter(player => player.id !== id)
        }));
    };

    // Get list of all player names for hitman dropdown
    const getPlayerNames = () => {
        return tournamentData.players.map(player => player.name).filter(name => name.trim() !== '');
    };

    const exportToText = () => {
        const { name, date, director, players } = tournamentData;

        let output = `Tournament: ${name}\n`;
        output += `Date: ${date}\n`;
        output += `Director: ${director}\n`;
        output += `\n--- PLAYERS ---\n`;

        // Sort players by KO position (nulls last)
        const sortedPlayers = [...players].sort((a, b) => {
            if (a.koPosition === null && b.koPosition === null) return 0;
            if (a.koPosition === null) return 1;
            if (b.koPosition === null) return -1;
            return a.koPosition - b.koPosition;
        });

        sortedPlayers.forEach(player => {
            output += `Player: ${player.name}`;
            if (player.hitman) output += ` | Hitman: ${player.hitman}`;
            if (player.koPosition !== null) output += ` | KO Position: ${player.koPosition}`;
            output += '\n';
        });

        // Create and download file
        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tournament_${name.replace(/\s+/g, '_')}_${date}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setSaveStatus('Exported successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
    };

    const copyToClipboard = () => {
        const { name, date, director, players } = tournamentData;

        let output = `Tournament: ${name}\n`;
        output += `Date: ${date}\n`;
        output += `Director: ${director}\n`;
        output += `\n--- PLAYERS ---\n`;

        const sortedPlayers = [...players].sort((a, b) => {
            if (a.koPosition === null && b.koPosition === null) return 0;
            if (a.koPosition === null) return 1;
            if (b.koPosition === null) return -1;
            return a.koPosition - b.koPosition;
        });

        sortedPlayers.forEach(player => {
            output += `Player: ${player.name}`;
            if (player.hitman) output += ` | Hitman: ${player.hitman}`;
            if (player.koPosition !== null) output += ` | KO Position: ${player.koPosition}`;
            output += '\n';
        });

        navigator.clipboard.writeText(output).then(() => {
            setSaveStatus('Copied to clipboard!');
            setTimeout(() => setSaveStatus(''), 3000);
        });
    };

    const clearTournament = () => {
        if (confirm('Are you sure you want to clear all tournament data? This cannot be undone.')) {
            setTournamentData({
                name: '',
                date: new Date().toISOString().split('T')[0],
                director: '',
                players: []
            });
            setSaveStatus('Tournament data cleared');
            setTimeout(() => setSaveStatus(''), 3000);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <Card className="w-96">
                    <CardHeader>
                        <CardTitle>Tournament Entry - Admin Login</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleLogin(e)}
                                className="w-full px-3 py-2 border rounded text-black"
                                placeholder="Enter admin password"
                                required
                            />
                            <button
                                onClick={handleLogin}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Login
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-6xl mx-auto">
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Tournament Entry System</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={exportToText}
                                    className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                >
                                    <Download size={16} />
                                    Export
                                </button>
                                <button
                                    onClick={copyToClipboard}
                                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                >
                                    <Copy size={16} />
                                    Copy
                                </button>
                                <button
                                    onClick={clearTournament}
                                    className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                >
                                    <RotateCcw size={16} />
                                    Clear
                                </button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {saveStatus && (
                            <div className="mb-4 p-2 bg-green-100 text-green-800 rounded">
                                {saveStatus}
                            </div>
                        )}

                        {/* Tournament Metadata */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Tournament Name
                                </label>
                                <input
                                    type="text"
                                    value={tournamentData.name}
                                    onChange={(e) => setTournamentData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-black"
                                    placeholder="Enter tournament name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={tournamentData.date}
                                    onChange={(e) => setTournamentData(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-black"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Tournament Director
                                </label>
                                <input
                                    type="text"
                                    value={tournamentData.director}
                                    onChange={(e) => setTournamentData(prev => ({ ...prev, director: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded text-black"
                                    placeholder="Enter TD name"
                                />
                            </div>
                        </div>

                        {/* Add New Player */}
                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newPlayerName}
                                onChange={(e) => setNewPlayerName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                                className="flex-1 px-3 py-2 border rounded text-black"
                                placeholder="Enter new player name"
                            />
                            <button
                                onClick={addPlayer}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                <Plus size={16} />
                                Add Player
                            </button>
                        </div>

                        {/* Players Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="border border-gray-300 px-4 py-2 text-left text-gray-900">Player Name</th>
                                        <th className="border border-gray-300 px-4 py-2 text-left text-gray-900">Hitman</th>
                                        <th className="border border-gray-300 px-4 py-2 text-left text-gray-900">KO Position</th>
                                        <th className="border border-gray-300 px-4 py-2 text-center text-gray-900">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tournamentData.players.map((player) => (
                                        <tr key={player.id} className="hover:bg-gray-50">
                                            <td className="border border-gray-300 px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={player.name}
                                                    onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-black"
                                                />
                                            </td>
                                            <td className="border border-gray-300 px-4 py-2">
                                                <HitmanDropdown
                                                    playerId={player.id}
                                                    currentValue={player.hitman}
                                                    playerNames={getPlayerNames()}
                                                    onSelect={handleHitmanSelect}
                                                />
                                            </td>
                                            <td className="border border-gray-300 px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={player.koPosition || ''}
                                                    onChange={(e) => updatePlayer(player.id, 'koPosition', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-black"
                                                    placeholder="KO order"
                                                    min="1"
                                                />
                                            </td>
                                            <td className="border border-gray-300 px-4 py-2 text-center">
                                                <button
                                                    onClick={() => removePlayer(player.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Remove player"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {tournamentData.players.length === 0 && (
                                <div className="text-center py-8 text-gray-900">
                                    No players added yet. Add a player above to get started.
                                </div>
                            )}
                        </div>

                        {/* Tournament Summary */}
                        {tournamentData.players.length > 0 && (
                            <div className="mt-6 p-4 bg-gray-50 rounded">
                                <h3 className="font-medium text-gray-900 mb-2">Tournament Summary</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-900">
                                    <div>
                                        <span className="font-medium">Total Players:</span> {tournamentData.players.length}
                                    </div>
                                    <div>
                                        <span className="font-medium">Knocked Out:</span> {tournamentData.players.filter(p => p.koPosition !== null).length}
                                    </div>
                                    <div>
                                        <span className="font-medium">Still Playing:</span> {tournamentData.players.filter(p => p.koPosition === null).length}
                                    </div>
                                    <div>
                                        <span className="font-medium">Data Auto-Saved:</span> ✓
                                    </div>
                                </div>

                                {/* Debug info - remove after testing */}
                                <div className="mt-4 p-2 bg-yellow-100 rounded text-xs text-gray-700">
                                    <strong>Debug:</strong> Check browser console for localStorage logs.
                                    Try opening Developer Tools (F12) → Console tab to see save/load messages.
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}