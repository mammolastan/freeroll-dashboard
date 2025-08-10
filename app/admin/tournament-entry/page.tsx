'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Download, Copy, Save, RotateCcw, CheckCircle, AlertCircle, Clock, Database } from 'lucide-react';

interface Player {
    id: number;
    player_name: string;
    player_uid: string | null;
    is_new_player: boolean;
    hitman_name: string | null;
    ko_position: number | null;
    placement: number | null;
}

interface TournamentDraft {
    id: number;
    tournament_name: string;
    tournament_date: string;
    director_name: string;
    venue: string;
    start_points: number;
    status: string;
    updated_at: string;
}

interface HitmanDropdownProps {
    playerId: number;
    currentValue: string;
    playerNames: string[];
    onSelect: (playerId: number, hitman: string) => void;
}

interface SaveStatus {
    status: 'idle' | 'saving' | 'saved' | 'error';
    message: string;
}

function HitmanDropdown({ playerId, currentValue, playerNames, onSelect }: HitmanDropdownProps) {
    const [inputValue, setInputValue] = useState(currentValue || '');
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredNames, setFilteredNames] = useState<string[]>([]);

    useEffect(() => {
        setInputValue(currentValue || '');
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
    const [currentDraft, setCurrentDraft] = useState<TournamentDraft | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [playerSearchResults, setPlayerSearchResults] = useState<any[]>([]);
    const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: 'idle', message: '' });
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
    const [isIntegrating, setIsIntegrating] = useState(false);

    // Auto-save debounced function
    const debouncedSave = useCallback(async (data: any, type: 'tournament' | 'player', playerId?: number) => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }

        const timeout = setTimeout(async () => {
            setSaveStatus({ status: 'saving', message: 'Saving...' });

            try {
                if (type === 'tournament' && currentDraft) {
                    const response = await fetch(`/api/tournament-drafts/${currentDraft.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    if (!response.ok) throw new Error('Failed to save tournament');
                } else if (type === 'player' && playerId && currentDraft) {
                    const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players/${playerId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    if (!response.ok) throw new Error('Failed to save player');
                }

                setSaveStatus({ status: 'saved', message: 'Saved' });
                setTimeout(() => setSaveStatus({ status: 'idle', message: '' }), 2000);
            } catch (error) {
                setSaveStatus({ status: 'error', message: 'Error saving' });
                setTimeout(() => setSaveStatus({ status: 'idle', message: '' }), 3000);
            }
        }, 500);

        setSaveTimeout(timeout);
    }, [currentDraft, saveTimeout]);

    // Initialize or create new tournament
    const initializeTournament = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch('/api/tournament-drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournament_name: '',
                    tournament_date: today,
                    director_name: '',
                    venue: 'New Venue',
                    start_points: 3
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                throw new Error(`Failed to create tournament: ${errorData.error || response.statusText}`);
            }

            const newDraft = await response.json();
            console.log('New draft received:', newDraft);

            // Handle both array and object responses
            const draftData = Array.isArray(newDraft) ? newDraft[0] : newDraft;
            setCurrentDraft(draftData);
            loadPlayers(draftData.id);
        } catch (error) {
            console.error('Error initializing tournament:', error);
            alert(`Failed to initialize tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Load players for current tournament
    const loadPlayers = async (draftId: number) => {
        try {
            const response = await fetch(`/api/tournament-drafts/${draftId}/players`);
            if (!response.ok) throw new Error('Failed to load players');

            const playersData = await response.json();
            setPlayers(playersData);
        } catch (error) {
            console.error('Error loading players:', error);
        }
    };

    // Player search effect
    useEffect(() => {
        if (newPlayerName.length < 2) {
            setPlayerSearchResults([]);
            setShowPlayerDropdown(false);
            return;
        }

        const searchTimer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`/api/players/search?q=${encodeURIComponent(newPlayerName)}&name=true`);
                const data = await response.json();
                setPlayerSearchResults(data);
                setShowPlayerDropdown(data.length > 0);
            } catch (error) {
                console.error('Failed to search players:', error);
                setPlayerSearchResults([]);
                setShowPlayerDropdown(false);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(searchTimer);
    }, [newPlayerName]);

    // Initialize tournament on component mount
    useEffect(() => {
        if (isAuthenticated && !currentDraft) {
            initializeTournament();
        }
    }, [isAuthenticated]);

    const handleLogin = async (e: any) => {
        if (e.key === 'Enter' || e.type === 'click') {
            const response = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            setIsAuthenticated(data.authenticated);
        }
    };

    const updateTournamentField = (field: string, value: string | number) => {
        if (!currentDraft) return;

        const updatedDraft = { ...currentDraft, [field]: value };
        setCurrentDraft(updatedDraft);

        // Auto-save tournament data
        debouncedSave({
            tournament_name: updatedDraft.tournament_name,
            tournament_date: updatedDraft.tournament_date,
            director_name: updatedDraft.director_name,
            venue: updatedDraft.venue,
            start_points: updatedDraft.start_points
        }, 'tournament');
    };

    const addPlayer = async () => {
        if (!newPlayerName.trim() || !currentDraft) return;

        const playerName = newPlayerName.trim();

        // Check if player already exists
        const existingPlayer = players.find(
            player => player.player_name.toLowerCase() === playerName.toLowerCase()
        );

        if (existingPlayer) {
            alert(`Player "${playerName}" is already in the tournament!`);
            setNewPlayerName('');
            return;
        }

        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_name: playerName,
                    player_uid: null,
                    is_new_player: true
                })
            });

            if (!response.ok) throw new Error('Failed to add player');

            const newPlayer = await response.json();
            setPlayers(prev => [...prev, newPlayer[0]]);
            setNewPlayerName('');
            setShowPlayerDropdown(false);
        } catch (error) {
            console.error('Error adding player:', error);
            alert('Failed to add player');
        }
    };

    const handlePlayerSelect = async (player: any) => {
        if (!currentDraft) return;

        const playerName = player.nickname || player.Name;

        // Check if player already exists
        const existingPlayer = players.find(
            p => p.player_name.toLowerCase() === playerName.toLowerCase()
        );

        if (existingPlayer) {
            alert(`Player "${playerName}" is already in the tournament!`);
            setNewPlayerName('');
            setShowPlayerDropdown(false);
            return;
        }

        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_name: playerName,
                    player_uid: player.UID,
                    is_new_player: false
                })
            });

            if (!response.ok) throw new Error('Failed to add player');

            const newPlayer = await response.json();
            setPlayers(prev => [...prev, newPlayer[0]]);
            setNewPlayerName('');
            setShowPlayerDropdown(false);
        } catch (error) {
            console.error('Error adding player:', error);
            alert('Failed to add player');
        }
    };

    const updatePlayer = (playerId: number, field: string, value: string | number | null) => {
        setPlayers(prev => {
            const updatedPlayers = prev.map(player => {
                if (player.id === playerId) {
                    let updatedPlayer = {
                        ...player,
                        [field]: field === 'ko_position' || field === 'placement'
                            ? (value === '' || value === null ? null : Number(value))
                            : value
                    };

                    // Auto-increment KO position when hitman is set and KO position is empty
                    if (field === 'hitman_name' && value && !updatedPlayer.ko_position) {
                        const maxKoPosition = prev
                            .filter(p => p.ko_position !== null)
                            .reduce((max, p) => Math.max(max, p.ko_position!), 0);
                        updatedPlayer.ko_position = maxKoPosition + 1;
                    }

                    // Auto-save player data
                    debouncedSave({
                        player_name: updatedPlayer.player_name,
                        hitman_name: updatedPlayer.hitman_name,
                        ko_position: updatedPlayer.ko_position,
                        placement: updatedPlayer.placement
                    }, 'player', playerId);

                    return updatedPlayer;
                }
                return player;
            });

            return updatedPlayers;
        });
    };

    const handleHitmanSelect = (playerId: number, hitman: string) => {
        updatePlayer(playerId, 'hitman_name', hitman);
    };

    const removePlayer = async (playerId: number) => {
        if (!currentDraft) return;

        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players/${playerId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to remove player');

            setPlayers(prev => prev.filter(player => player.id !== playerId));
        } catch (error) {
            console.error('Error removing player:', error);
            alert('Failed to remove player');
        }
    };

    const getPlayerNames = () => {
        return players.map(player => player.player_name).filter(name => name.trim() !== '');
    };

    const exportToText = () => {
        if (!currentDraft) return;

        let output = `Tournament: ${currentDraft.tournament_name}\n`;
        output += `Date: ${currentDraft.tournament_date}\n`;
        output += `Director: ${currentDraft.director_name}\n`;
        output += `Venue: ${currentDraft.venue}\n`;
        output += `Start Points: ${currentDraft.start_points}\n`;
        output += `\n--- PLAYERS ---\n`;

        const sortedPlayers = [...players].sort((a, b) => {
            if (a.ko_position === null && b.ko_position === null) return 0;
            if (a.ko_position === null) return 1;
            if (b.ko_position === null) return -1;
            return a.ko_position - b.ko_position;
        });

        sortedPlayers.forEach(player => {
            output += `Player: ${player.player_name}`;
            if (player.is_new_player) output += ' (NEW)';
            if (player.hitman_name) output += ` | Hitman: ${player.hitman_name}`;
            if (player.ko_position !== null) output += ` | KO Position: ${player.ko_position}`;
            if (player.placement !== null) output += ` | Final Position: ${player.placement}`;
            output += '\n';
        });

        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tournament_${currentDraft.tournament_name.replace(/\s+/g, '_')}_${currentDraft.tournament_date}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const integrateToMainSystem = async () => {
        if (!currentDraft) return;

        if (!confirm('Are you sure you want to integrate this tournament into the main system? This cannot be undone.')) {
            return;
        }

        setIsIntegrating(true);

        try {
            // First validate
            const validateResponse = await fetch(`/api/tournament-drafts/${currentDraft.id}/integrate`);
            const validation = await validateResponse.json();

            if (!validation.isValid) {
                alert(`Cannot integrate tournament:\n${validation.errors.join('\n')}`);
                return;
            }

            if (validation.warnings.length > 0) {
                const proceed = confirm(`Warnings found:\n${validation.warnings.join('\n')}\n\nContinue with integration?`);
                if (!proceed) return;
            }

            // Integrate
            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/integrate`, {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Tournament successfully integrated!\n\nGame UID: ${result.gameUID}\nFile Name: ${result.fileName}\nPlayers: ${result.playersIntegrated}\nNew Players Created: ${result.newPlayersCreated}`);

                // Refresh current draft to show integrated status
                const updatedDraft = { ...currentDraft, status: 'integrated' };
                setCurrentDraft(updatedDraft);
            } else {
                alert(`Integration failed:\n${result.error}\n${result.details ? result.details.join('\n') : ''}`);
            }
        } catch (error) {
            console.error('Error integrating tournament:', error);
            alert('Failed to integrate tournament');
        } finally {
            setIsIntegrating(false);
        }
    };

    const clearTournament = async () => {
        if (!confirm('Are you sure you want to clear all tournament data? This will create a new draft.')) {
            return;
        }

        if (currentDraft) {
            try {
                // Delete current draft
                await fetch(`/api/tournament-drafts/${currentDraft.id}`, {
                    method: 'DELETE'
                });
            } catch (error) {
                console.error('Error deleting draft:', error);
            }
        }

        // Create new draft
        setCurrentDraft(null);
        setPlayers([]);
        await initializeTournament();
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
                            <div className="flex items-center gap-3">
                                <span>Tournament Entry System</span>
                                <div className="flex items-center gap-2">
                                    <Database size={16} className="text-blue-600" />
                                    <span className="text-sm text-gray-600">Auto-Save Enabled</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Save Status Indicator */}
                                {saveStatus.status !== 'idle' && (
                                    <div className="flex items-center gap-1 text-sm">
                                        {saveStatus.status === 'saving' && <Clock size={14} className="text-blue-500" />}
                                        {saveStatus.status === 'saved' && <CheckCircle size={14} className="text-green-500" />}
                                        {saveStatus.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                                        <span className={`
                                            ${saveStatus.status === 'saving' ? 'text-blue-600' : ''}
                                            ${saveStatus.status === 'saved' ? 'text-green-600' : ''}
                                            ${saveStatus.status === 'error' ? 'text-red-600' : ''}
                                        `}>
                                            {saveStatus.message}
                                        </span>
                                    </div>
                                )}

                                <button
                                    onClick={exportToText}
                                    className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                >
                                    <Download size={16} />
                                    Export
                                </button>

                                {currentDraft?.status === 'in_progress' && (
                                    <button
                                        onClick={integrateToMainSystem}
                                        disabled={isIntegrating || players.length === 0}
                                        className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm disabled:bg-gray-400"
                                    >
                                        <Database size={16} />
                                        {isIntegrating ? 'Integrating...' : 'Integrate to Main System'}
                                    </button>
                                )}

                                <button
                                    onClick={clearTournament}
                                    className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                >
                                    <RotateCcw size={16} />
                                    New Tournament
                                </button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Tournament Status */}
                        {currentDraft && (
                            <div className="mb-4 p-3 bg-blue-50 rounded">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-blue-900">
                                        Status: {currentDraft.status.charAt(0).toUpperCase() + currentDraft.status.slice(1)}
                                    </span>
                                    <span className="text-sm text-blue-700">
                                        Last updated: {new Date(currentDraft.updated_at).toLocaleString()}
                                    </span>
                                </div>
                                {currentDraft.status === 'integrated' && (
                                    <div className="mt-2 text-sm text-blue-700">
                                        This tournament has been integrated into the main system.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tournament Metadata */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Tournament Name
                                </label>
                                <input
                                    type="text"
                                    value={currentDraft?.tournament_name || ''}
                                    onChange={(e) => updateTournamentField('tournament_name', e.target.value)}
                                    className="w-full px-3 py-2 border rounded text-black"
                                    placeholder="Enter tournament name"
                                    disabled={currentDraft?.status === 'integrated'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={currentDraft?.tournament_date || ''}
                                    onChange={(e) => updateTournamentField('tournament_date', e.target.value)}
                                    className="w-full px-3 py-2 border rounded text-black"
                                    disabled={currentDraft?.status === 'integrated'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Tournament Director
                                </label>
                                <input
                                    type="text"
                                    value={currentDraft?.director_name || ''}
                                    onChange={(e) => updateTournamentField('director_name', e.target.value)}
                                    className="w-full px-3 py-2 border rounded text-black"
                                    placeholder="Enter TD name"
                                    disabled={currentDraft?.status === 'integrated'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Venue
                                </label>
                                <input
                                    type="text"
                                    value={currentDraft?.venue || ''}
                                    onChange={(e) => updateTournamentField('venue', e.target.value)}
                                    className="w-full px-3 py-2 border rounded text-black"
                                    placeholder="Enter venue name"
                                    disabled={currentDraft?.status === 'integrated'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Start Points
                                </label>
                                <input
                                    type="number"
                                    value={currentDraft?.start_points || 0}
                                    onChange={(e) => updateTournamentField('start_points', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border rounded text-black"
                                    min="0"
                                    disabled={currentDraft?.status === 'integrated'}
                                />
                            </div>
                        </div>

                        {/* Add New Player */}
                        {currentDraft?.status === 'in_progress' && (
                            <div className="relative mb-6">
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={newPlayerName}
                                            onChange={(e) => setNewPlayerName(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                                            onFocus={() => newPlayerName.length >= 2 && setShowPlayerDropdown(playerSearchResults.length > 0)}
                                            onBlur={() => setTimeout(() => setShowPlayerDropdown(false), 200)}
                                            className="w-full px-3 py-2 border rounded text-black"
                                            placeholder="Enter new player name (type 2+ chars to search existing)"
                                        />

                                        {isSearching && (
                                            <div className="absolute right-3 top-3 text-gray-400">
                                                Searching...
                                            </div>
                                        )}

                                        {showPlayerDropdown && (
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto">
                                                {playerSearchResults.map((player) => {
                                                    const playerName = player.nickname || player.Name;
                                                    const isAlreadyAdded = players.some(
                                                        p => p.player_name.toLowerCase() === playerName.toLowerCase()
                                                    );

                                                    return (
                                                        <div
                                                            key={player.UID}
                                                            className={`px-4 py-2 cursor-pointer text-black border-b border-gray-100 last:border-0 ${isAlreadyAdded
                                                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                                : 'hover:bg-gray-100'
                                                                }`}
                                                            onMouseDown={() => !isAlreadyAdded && handlePlayerSelect(player)}
                                                        >
                                                            <div className={`font-medium ${isAlreadyAdded ? 'line-through' : ''}`}>
                                                                {playerName}
                                                                {isAlreadyAdded && <span className="ml-2 text-xs">(Already added)</span>}
                                                            </div>
                                                            {player.TotalGames && (
                                                                <div className="text-sm text-gray-500">
                                                                    {player.TotalGames} games played
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={addPlayer}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        <Plus size={16} />
                                        Add Player
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tournament Summary */}
                        {players.length > 0 && (
                            <div className="mt-6 p-4 bg-gray-50 rounded">
                                <h3 className="font-medium text-gray-900 mb-2">Tournament Summary</h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-900">
                                    <div>
                                        <span className="font-medium">Total Players:</span> {players.length}
                                    </div>
                                    <div>
                                        <span className="font-medium">New Players:</span> {players.filter(p => p.is_new_player).length}
                                    </div>
                                    <div>
                                        <span className="font-medium">With Placements:</span> {players.filter(p => p.placement !== null).length}
                                    </div>
                                    <div>
                                        <span className="font-medium">Knocked Out:</span> {players.filter(p => p.ko_position !== null).length}
                                    </div>
                                    <div>
                                        <span className="font-medium">Auto-Save:</span> <CheckCircle size={16} className="inline text-green-600" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Players Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="border border-gray-300 px-4 py-2 text-left text-gray-900">
                                            Player Name
                                        </th>
                                        <th className="border border-gray-300 px-4 py-2 text-left text-gray-900">
                                            Hitman
                                        </th>
                                        <th className="border border-gray-300 px-4 py-2 text-left text-gray-900">
                                            KO Position
                                        </th>
                                        <th className="border border-gray-300 px-4 py-2 text-left text-gray-900">
                                            Final Placement
                                        </th>
                                        {currentDraft?.status === 'in_progress' && (
                                            <th className="border border-gray-300 px-4 py-2 text-center text-gray-900">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map((player) => (
                                        <tr key={player.id} className="hover:bg-gray-50">
                                            <td className="border border-gray-300 px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={player.player_name}
                                                        onChange={(e) => updatePlayer(player.id, 'player_name', e.target.value)}
                                                        className="w-full px-2 py-1 border rounded text-black"
                                                        disabled={currentDraft?.status === 'integrated'}
                                                    />
                                                    {player.is_new_player && (
                                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded font-medium">
                                                            NEW
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="border border-gray-300 px-4 py-2">
                                                {currentDraft?.status === 'in_progress' ? (
                                                    <HitmanDropdown
                                                        playerId={player.id}
                                                        currentValue={player.hitman_name || ''}
                                                        playerNames={getPlayerNames()}
                                                        onSelect={handleHitmanSelect}
                                                    />
                                                ) : (
                                                    <span className="text-black">{player.hitman_name || '-'}</span>
                                                )}
                                            </td>
                                            <td className="border border-gray-300 px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={player.ko_position || ''}
                                                    onChange={(e) => updatePlayer(player.id, 'ko_position', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-black"
                                                    placeholder="KO order"
                                                    min="1"
                                                    disabled={currentDraft?.status === 'integrated'}
                                                />
                                            </td>
                                            <td className="border border-gray-300 px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={player.placement || ''}
                                                    onChange={(e) => updatePlayer(player.id, 'placement', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-black"
                                                    placeholder="Final position"
                                                    min="1"
                                                    disabled={currentDraft?.status === 'integrated'}
                                                />
                                            </td>
                                            {currentDraft?.status === 'in_progress' && (
                                                <td className="border border-gray-300 px-4 py-2 text-center">
                                                    <button
                                                        onClick={() => removePlayer(player.id)}
                                                        className="text-red-600 hover:text-red-800"
                                                        title="Remove player"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {players.length === 0 && (
                                <div className="text-center py-8 text-gray-900">
                                    No players added yet. Add a player above to get started.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}