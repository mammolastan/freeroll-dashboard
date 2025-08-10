'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Upload, Users, Trophy, RotateCcw, Calendar, MapPin, User, Plus, ArrowLeft, Check, X, ChevronDown } from 'lucide-react';

interface TournamentDraft {
    id: number;
    tournament_date: string;
    director_name: string;
    venue: string;
    start_points: number;
    status: 'in_progress' | 'finalized' | 'integrated';
    created_at: string;
    updated_at: string;
    player_count: number;
}

interface Player {
    id: number;
    player_name: string;
    player_uid: string | null;
    is_new_player: boolean;
    hitman_name: string | null;
    ko_position: number | null;
    placement: number | null;
}

interface PlayerSearchResult {
    Name: string;
    UID: string;
    nickname: string | null;
    TotalGames?: number;
    TotalPoints?: number;
}

export default function TournamentEntryPage() {
    // Authentication
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

    // Tournament management
    const [currentView, setCurrentView] = useState<'welcome' | 'entry'>('welcome');
    const [tournaments, setTournaments] = useState<TournamentDraft[]>([]);
    const [currentDraft, setCurrentDraft] = useState<TournamentDraft | null>(null);
    const [loadingTournaments, setLoadingTournaments] = useState(false);

    // New tournament modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTournament, setNewTournament] = useState({
        tournament_date: '',
        director_name: '',
        venue: '',
        start_points: 0
    });

    // Player management
    const [players, setPlayers] = useState<Player[]>([]);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchResult[]>([]);
    const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isIntegrating, setIsIntegrating] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'ko_position' | 'insertion'>('insertion');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // desc means newest first for insertion

    const [hitmanSearchValues, setHitmanSearchValues] = useState<{ [key: number]: string }>({});
    const [hitmanDropdownVisible, setHitmanDropdownVisible] = useState<{ [key: number]: boolean }>({});

    // Venue management
    const [venues, setVenues] = useState<string[]>([]);
    const [showVenueDropdown, setShowVenueDropdown] = useState(false);
    const [isAddingNewVenue, setIsAddingNewVenue] = useState(false);
    const [newVenueInput, setNewVenueInput] = useState('');
    const [loadingVenues, setLoadingVenues] = useState(false);


    // Load tournaments list
    const loadTournaments = async () => {
        setLoadingTournaments(true);
        try {
            const response = await fetch('/api/tournament-drafts');
            if (!response.ok) throw new Error('Failed to load tournaments');

            const data = await response.json();
            setTournaments(data);
        } catch (error) {
            console.error('Error loading tournaments:', error);
            alert('Failed to load tournaments');
        } finally {
            setLoadingTournaments(false);
        }
    };

    // Create new tournament
    const createTournament = async () => {
        if (!newTournament.tournament_date || !newTournament.venue) {
            alert('Date and venue are required');
            return;
        }

        try {
            const response = await fetch('/api/tournament-drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTournament)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create tournament');
            }

            const tournament = await response.json();
            setCurrentDraft(tournament);
            setPlayers([]);
            setCurrentView('entry');
            setShowCreateModal(false);
            setNewTournament({
                tournament_date: getTodayDateString(), // Changed this line
                director_name: '',
                venue: '',
                start_points: 0
            });

            // Refresh tournaments list and venues (in case a new venue was added)
            loadTournaments();
            loadVenues(); // Add this line
        } catch (error) {
            console.error('Error creating tournament:', error);
            alert(`Failed to create tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Select existing tournament
    const selectTournament = async (tournament: TournamentDraft) => {
        console.log('Selecting tournament:', tournament.id);
        setCurrentDraft(tournament);
        setCurrentView('entry');

        // Load players for this tournament
        try {
            console.log('Loading players for tournament:', tournament.id);
            const response = await fetch(`/api/tournament-drafts/${tournament.id}/players`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to load players:', response.status, errorText);
                throw new Error(`Failed to load players: ${errorText}`);
            }

            const playersData = await response.json();
            console.log('Loaded players data:', playersData);

            // Ensure the data structure is correct
            const formattedPlayers = Array.isArray(playersData) ? playersData : [];
            setPlayers(formattedPlayers);

            console.log('Players state set to:', formattedPlayers);
        } catch (error) {
            console.error('Error loading players:', error);
            setPlayers([]);
            alert(`Failed to load players: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const deleteTournament = async (tournamentId: number, tournamentName: string) => {
        if (!confirm(`Are you sure you want to delete the tournament "${tournamentName}"?\n\nThis will permanently delete the tournament and all its players. This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/tournament-drafts/${tournamentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Remove tournament from local state
                setTournaments(tournaments.filter(t => t.id !== tournamentId));
                alert('Tournament deleted successfully');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete tournament');
            }
        } catch (error) {
            console.error('Error deleting tournament:', error);
            alert(`Failed to delete tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Format today's date for input field (YYYY-MM-DD)
    const getTodayDateString = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    // Load venues from API
    const loadVenues = async () => {
        setLoadingVenues(true);
        try {
            const response = await fetch('/api/venues');
            if (!response.ok) throw new Error('Failed to load venues');

            const venuesData = await response.json();
            setVenues(venuesData);
        } catch (error) {
            console.error('Error loading venues:', error);
            alert('Failed to load venues');
        } finally {
            setLoadingVenues(false);
        }
    };

    // Handle venue selection
    const handleVenueSelect = (venue: string) => {
        setNewTournament({
            ...newTournament,
            venue: venue
        });
        setShowVenueDropdown(false);
        setIsAddingNewVenue(false);
        setNewVenueInput('');
    };

    // Handle new venue addition
    const handleAddNewVenue = () => {
        if (newVenueInput.trim()) {
            setNewTournament({
                ...newTournament,
                venue: newVenueInput.trim()
            });
            setShowVenueDropdown(false);
            setIsAddingNewVenue(false);
            setNewVenueInput('');
        }
    };

    // Update tournament field
    const updateTournamentField = async (field: string, value: string | number) => {
        if (!currentDraft || currentDraft.status === 'integrated') return;

        try {
            // Include tournament_name since it still exists in the database schema
            const updateData = {
                tournament_name: '', // Empty since we're not using tournament names anymore
                tournament_date: field === 'tournament_date' ? value : currentDraft.tournament_date,
                director_name: field === 'director_name' ? value : currentDraft.director_name,
                venue: field === 'venue' ? value : currentDraft.venue,
                start_points: field === 'start_points' ? value : currentDraft.start_points
            };

            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                // Update local state
                setCurrentDraft({ ...currentDraft, [field]: value });
            } else {
                const errorText = await response.text();
                console.error('Failed to update tournament field:', errorText);
            }
        } catch (error) {
            console.error('Error updating tournament:', error);
        }
    };

    // Format date for input field (convert from ISO to YYYY-MM-DD)
    const formatDateForInput = (isoDate: string) => {
        if (!isoDate) return '';
        return isoDate.split('T')[0];
    };

    // Sort players
    const sortPlayers = (playersToSort: Player[]) => {
        return [...playersToSort].sort((a, b) => {
            if (sortBy === 'name') {
                const nameA = a.player_name.toLowerCase();
                const nameB = b.player_name.toLowerCase();
                return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            } else if (sortBy === 'ko_position') {
                // Handle null values for KO position
                if (a.ko_position === null && b.ko_position === null) return 0;
                if (a.ko_position === null) return sortOrder === 'asc' ? 1 : -1;
                if (b.ko_position === null) return sortOrder === 'asc' ? -1 : 1;
                return sortOrder === 'asc' ? a.ko_position - b.ko_position : b.ko_position - a.ko_position;
            }
            return 0;
        });
    };

    // Handle column header click for sorting
    const handleSort = (column: 'name' | 'ko_position') => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const resetToDefaultSort = () => {
        if (sortBy === 'insertion') {
            // If already in insertion mode, toggle the order
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            // If not in insertion mode, go to insertion mode with newest first
            setSortBy('insertion');
            setSortOrder('desc'); // desc means newest first
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
                setShowPlayerDropdown(true);
            } catch (error) {
                console.error('Failed to search players:', error);
                setPlayerSearchResults([]);
                setShowPlayerDropdown(true);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(searchTimer);
    }, [newPlayerName]);

    // Add player
    const addPlayer = async (playerData: { name: string; uid?: string; isNew?: boolean }) => {
        if (!currentDraft) return;

        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_name: playerData.name,
                    player_uid: playerData.uid || null,
                    is_new_player: playerData.isNew || false
                })
            });

            if (response.ok) {
                const newPlayerResponse = await response.json();
                const newPlayer = Array.isArray(newPlayerResponse) ? newPlayerResponse[0] : newPlayerResponse;

                // Add new player to the TOP of the list
                setPlayers([newPlayer, ...players]);
                setNewPlayerName('');
                setShowPlayerDropdown(false);

                // Focus back to the input field
                setTimeout(() => {
                    const inputField = document.getElementById('player-search-input') as HTMLInputElement;
                    if (inputField) {
                        inputField.focus();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error adding player:', error);
        }
    };

    // Update player
    const updatePlayer = async (playerId: number, field: string, value: string | number | null) => {
        try {
            const player = players.find(p => p.id === playerId);
            if (!player) {
                console.error('Player not found:', playerId);
                return;
            }

            let updatedPlayer = { ...player, [field]: value };

            // Auto-assign KO position when hitman is selected
            if (field === 'hitman_name' && value) {
                // Find the next available KO position
                const usedKoPositions = players
                    .filter(p => p.ko_position !== null && p.id !== playerId)
                    .map(p => p.ko_position)
                    .sort((a, b) => (a || 0) - (b || 0));

                let nextKoPosition = 1;
                for (const pos of usedKoPositions) {
                    if (pos === nextKoPosition) {
                        nextKoPosition++;
                    } else {
                        break;
                    }
                }

                updatedPlayer = { ...updatedPlayer, ko_position: nextKoPosition };
            }

            // Clear KO position if hitman is removed
            if (field === 'hitman_name' && !value) {
                updatedPlayer = { ...updatedPlayer, ko_position: null };
            }

            console.log('Sending update request for player:', playerId, 'with data:', updatedPlayer);

            const response = await fetch(`/api/tournament-drafts/${currentDraft?.id}/players/${playerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPlayer)
            });

            if (response.ok) {
                const serverUpdatedPlayer = await response.json();
                console.log('Server returned updated player:', serverUpdatedPlayer);

                // Update local state with server response to ensure consistency
                setPlayers(players.map(p => p.id === playerId ? serverUpdatedPlayer : p));

                console.log('Local state updated successfully');
            } else {
                const errorText = await response.text();
                console.error('Failed to update player:', response.status, errorText);
                alert(`Failed to update player: ${errorText}`);
            }
        } catch (error) {
            console.error('Error updating player:', error);
            alert(`Error updating player: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Remove player
    const removePlayer = async (playerId: number) => {
        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft?.id}/players/${playerId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setPlayers(players.filter(p => p.id !== playerId));
            }
        } catch (error) {
            console.error('Error removing player:', error);
        }
    };

    // Filter players for hitman selection
    const getHitmanCandidates = (currentPlayerId: number, searchTerm: string) => {
        if (!searchTerm || searchTerm.length < 1) return [];

        return players
            .filter(p => p.id !== currentPlayerId) // Exclude the current player
            .filter(p => p.player_name.toLowerCase().includes(searchTerm.toLowerCase()))
            .slice(0, 10); // Limit to 10 results
    };

    // Handle hitman selection
    const selectHitman = (playerId: number, hitmanName: string) => {
        updatePlayer(playerId, 'hitman_name', hitmanName || null);
        setHitmanSearchValues(prev => ({ ...prev, [playerId]: hitmanName }));
        setHitmanDropdownVisible(prev => ({ ...prev, [playerId]: false }));
    };

    // Handle hitman search input changes
    const handleHitmanSearchChange = (playerId: number, value: string) => {
        setHitmanSearchValues(prev => ({ ...prev, [playerId]: value }));
        setHitmanDropdownVisible(prev => ({ ...prev, [playerId]: value.length > 0 }));

        // If the value exactly matches a player name, update immediately
        const exactMatch = players.find(p =>
            p.id !== playerId &&
            p.player_name.toLowerCase() === value.toLowerCase()
        );

        if (exactMatch) {
            updatePlayer(playerId, 'hitman_name', exactMatch.player_name);
        } else if (value === '') {
            // Clear hitman if input is empty
            updatePlayer(playerId, 'hitman_name', null);
        }
    };

    // Clear hitman search values when switching tournaments
    const clearHitmanSearchState = () => {
        setHitmanSearchValues({});
        setHitmanDropdownVisible({});
    };


    // Export tournament
    const exportTournament = () => {
        if (!currentDraft || players.length === 0) return;

        const sortedPlayers = [...players].sort((a, b) => {
            if (a.placement !== null && b.placement !== null) {
                return a.placement - b.placement;
            }
            if (a.placement !== null) return -1;
            if (b.placement !== null) return 1;
            return a.player_name.localeCompare(b.player_name);
        });

        let output = `Tournament: ${currentDraft.venue} - ${currentDraft.tournament_date}\n`;
        output += `Director: ${currentDraft.director_name}\n`;
        output += `Players: ${players.length}\n`;
        output += `Start Points: ${currentDraft.start_points}\n\n`;

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
        a.download = `tournament_${currentDraft.venue.replace(/\s+/g, '_')}_${currentDraft.tournament_date}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Integrate tournament
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

                // Update current draft status
                const updatedDraft = { ...currentDraft, status: 'integrated' as const };
                setCurrentDraft(updatedDraft);

                // Refresh tournaments list
                loadTournaments();
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

    // Authentication
    const handleLogin = async (e: any) => {
        if (e.key === 'Enter' || e.type === 'click') {
            const response = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                setIsAuthenticated(true);
                loadTournaments();
            } else {
                alert('Invalid password');
                setPassword('');
            }
        }
    };

    // Load tournaments on authentication
    useEffect(() => {
        if (isAuthenticated) {
            loadTournaments();
            loadVenues();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (showCreateModal) {
            setNewTournament(prev => ({
                ...prev,
                tournament_date: getTodayDateString()
            }));
        }
    }, [showCreateModal]);

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
                                onKeyPress={handleLogin}
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

    // Welcome Screen
    if (currentView === 'welcome') {
        return (
            <div className="min-h-screen bg-gray-100 p-4">
                <div className="max-w-6xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Trophy className="w-6 h-6 text-blue-600" />
                                    <span>Tournament Entry System</span>
                                </div>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                    <Plus size={16} />
                                    Create New Tournament
                                </button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                    Select a Tournament or Create New
                                </h2>
                                <p className="text-gray-600">
                                    Choose an existing tournament draft to continue working on, or create a new tournament.
                                </p>
                            </div>

                            {loadingTournaments ? (
                                <div className="text-center py-8">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <p className="mt-2 text-gray-600">Loading tournaments...</p>
                                </div>
                            ) : tournaments.length === 0 ? (
                                <div className="text-center py-8">
                                    <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600">No tournament drafts found.</p>
                                    <p className="text-gray-500 text-sm">Click "Create New Tournament" to get started.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">

                                    {tournaments.map((tournament) => (
                                        <div
                                            key={tournament.id}
                                            className="p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div
                                                    className="flex items-center gap-4 flex-1 cursor-pointer"
                                                    onClick={() => selectTournament(tournament)}
                                                >
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                                            <Calendar className="w-4 h-4 text-blue-600" />
                                                            {new Date(tournament.tournament_date).toLocaleDateString()}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <MapPin className="w-4 h-4" />
                                                            {tournament.venue}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                                        <div className="flex items-center gap-1">
                                                            <Users className="w-4 h-4" />
                                                            {tournament.player_count} players
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <User className="w-4 h-4" />
                                                            {tournament.director_name || 'No director'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${tournament.status === 'in_progress'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : tournament.status === 'integrated'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-blue-100 text-blue-800'
                                                        }`}>
                                                        {tournament.status === 'in_progress'
                                                            ? 'In Progress'
                                                            : tournament.status === 'integrated'
                                                                ? 'Integrated'
                                                                : 'Finalized'
                                                        }
                                                    </div>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent selecting the tournament when clicking delete
                                                            const tournamentName = `${new Date(tournament.tournament_date).toLocaleDateString()} - ${tournament.venue}`;
                                                            deleteTournament(tournament.id, tournamentName);
                                                        }}
                                                        className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs transition-colors"
                                                        title="Delete Tournament"
                                                    >
                                                        <X size={14} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Create Tournament Modal */}
                    {showCreateModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <Card className="w-96">
                                <CardHeader>
                                    <CardTitle>Create New Tournament</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                                Date *
                                            </label>
                                            <input
                                                type="date"
                                                value={newTournament.tournament_date}
                                                onChange={(e) => setNewTournament({
                                                    ...newTournament,
                                                    tournament_date: e.target.value
                                                })}
                                                className="w-full px-3 py-2 border rounded text-black"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                                Venue *
                                            </label>
                                            <div className="relative">
                                                {!isAddingNewVenue ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowVenueDropdown(!showVenueDropdown)}
                                                            className="w-full px-3 py-2 border rounded text-black text-left bg-white flex items-center justify-between"
                                                        >
                                                            <span className={newTournament.venue ? 'text-black' : 'text-gray-500'}>
                                                                {newTournament.venue || 'Select venue...'}
                                                            </span>
                                                            <ChevronDown size={16} />
                                                        </button>

                                                        {showVenueDropdown && (
                                                            <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                                                                {loadingVenues ? (
                                                                    <div className="px-3 py-2 text-gray-500">Loading venues...</div>
                                                                ) : (
                                                                    <>
                                                                        {venues.map((venue, index) => (
                                                                            <button
                                                                                key={index}
                                                                                type="button"
                                                                                onClick={() => handleVenueSelect(venue)}
                                                                                className="w-full px-3 py-2 text-left hover:bg-gray-100 text-black"
                                                                            >
                                                                                {venue}
                                                                            </button>
                                                                        ))}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setIsAddingNewVenue(true)}
                                                                            className="w-full px-3 py-2 text-left hover:bg-gray-100 text-blue-600 border-t"
                                                                        >
                                                                            + Add new venue
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newVenueInput}
                                                            onChange={(e) => setNewVenueInput(e.target.value)}
                                                            onKeyPress={(e) => e.key === 'Enter' && handleAddNewVenue()}
                                                            placeholder="Enter new venue name"
                                                            className="flex-1 px-3 py-2 border rounded text-black"
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleAddNewVenue}
                                                            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsAddingNewVenue(false);
                                                                setNewVenueInput('');
                                                                setShowVenueDropdown(true);
                                                            }}
                                                            className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                                Director
                                            </label>
                                            <input
                                                type="text"
                                                value={newTournament.director_name}
                                                onChange={(e) => setNewTournament({
                                                    ...newTournament,
                                                    director_name: e.target.value
                                                })}
                                                className="w-full px-3 py-2 border rounded text-black"
                                                placeholder="Tournament director"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                                Start Points
                                            </label>
                                            <input
                                                type="number"
                                                value={newTournament.start_points}
                                                onChange={(e) => setNewTournament({
                                                    ...newTournament,
                                                    start_points: parseInt(e.target.value) || 0
                                                })}
                                                className="w-full px-3 py-2 border rounded text-black"
                                                placeholder="Starting points"
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-4">
                                            <button
                                                onClick={createTournament}
                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                            >
                                                Create Tournament
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowCreateModal(false);
                                                    setIsAddingNewVenue(false); // Add this line
                                                    setNewVenueInput(''); // Add this line
                                                    setShowVenueDropdown(false); // Add this line
                                                }}
                                                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Tournament Entry Interface
    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-6xl mx-auto">
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setCurrentView('welcome')}
                                    className="flex items-center gap-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                                >
                                    <ArrowLeft size={16} />
                                    Back to Tournaments
                                </button>

                                <div>
                                    <div className="text-lg font-semibold">
                                        {new Date(currentDraft?.tournament_date || '').toLocaleDateString()} - {currentDraft?.venue}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {currentDraft?.director_name ? `Director: ${currentDraft.director_name}` : 'No director assigned'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={exportTournament}
                                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                >
                                    <Upload size={16} />
                                    Export
                                </button>

                                {currentDraft?.status === 'in_progress' && (
                                    <button
                                        onClick={integrateToMainSystem}
                                        disabled={isIntegrating}
                                        className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                                    >
                                        <Check size={16} />
                                        {isIntegrating ? 'Integrating...' : 'Integrate to Main System'}
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        if (confirm('Are you sure you want to create a new tournament? This will leave the current tournament.')) {
                                            setCurrentView('welcome');
                                            setCurrentDraft(null);
                                            setPlayers([]);
                                        }
                                    }}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={formatDateForInput(currentDraft?.tournament_date || '')}
                                    onChange={(e) => updateTournamentField('tournament_date', e.target.value)}
                                    className="w-full px-3 py-2 border rounded text-black"
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
                                    placeholder="Tournament venue"
                                    disabled={currentDraft?.status === 'integrated'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Director
                                </label>
                                <input
                                    type="text"
                                    value={currentDraft?.director_name || ''}
                                    onChange={(e) => updateTournamentField('director_name', e.target.value)}
                                    className="w-full px-3 py-2 border rounded text-black"
                                    placeholder="Director name"
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
                                    disabled={currentDraft?.status === 'integrated'}
                                />
                            </div>
                        </div>

                        {/* Add Player Section */}
                        {currentDraft?.status !== 'integrated' && (
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Add Player
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={newPlayerName}
                                        onChange={(e) => setNewPlayerName(e.target.value)}
                                        onFocus={() => {
                                            if (newPlayerName.length >= 2) {
                                                setShowPlayerDropdown(true);
                                            }
                                        }}
                                        className="w-full px-3 py-2 pr-8 border rounded text-black"
                                        placeholder="Start typing player name..."
                                        id="player-search-input"
                                    />

                                    {/* Close button - only show when dropdown is open */}
                                    {showPlayerDropdown && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPlayerDropdown(false)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}

                                    {showPlayerDropdown && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                                            {isSearching ? (
                                                <div className="px-3 py-2 text-gray-500">Searching...</div>
                                            ) : (
                                                <>
                                                    {playerSearchResults.map((player) => {
                                                        const isAlreadyAdded = players.some(p => {
                                                            const uidMatch = p.player_uid === player.UID;
                                                            const nameMatch = p.player_name.toLowerCase() === player.Name.toLowerCase();
                                                            const nicknameMatch = p.player_name.toLowerCase() === (player.nickname || '').toLowerCase();
                                                            return uidMatch || nameMatch || nicknameMatch;
                                                        });

                                                        return (
                                                            <div
                                                                key={player.UID}
                                                                onClick={() => {
                                                                    if (!isAlreadyAdded) {
                                                                        addPlayer({ name: player.Name, uid: player.UID });
                                                                    } else {
                                                                        alert('This player is already in the tournament!');
                                                                    }
                                                                }}
                                                                className={`px-3 py-2 border-b last:border-b-0 ${isAlreadyAdded
                                                                    ? 'bg-red-100 text-red-600 cursor-not-allowed opacity-75'
                                                                    : 'hover:bg-blue-50 cursor-pointer'
                                                                    }`}
                                                            >
                                                                <div className={`font-medium ${isAlreadyAdded ? 'line-through' : 'text-gray-900'}`}>
                                                                    {player.nickname ? `${player.Name} (${player.nickname})` : player.Name}
                                                                    {isAlreadyAdded && <span className="ml-2 text-xs text-red-600 font-bold">(ALREADY ADDED)</span>}
                                                                </div>
                                                                {(player.TotalGames || player.TotalPoints) && (
                                                                    <div className="text-sm text-gray-600">
                                                                        {player.TotalGames || 0} games, {player.TotalPoints || 0} points
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {newPlayerName.trim() && (
                                                        <div
                                                            onClick={() => addPlayer({ name: newPlayerName.trim(), isNew: true })}
                                                            className="px-3 py-2 hover:bg-green-50 cursor-pointer border-t bg-green-25"
                                                        >
                                                            <div className="font-medium text-green-700">
                                                                Add "{newPlayerName.trim()}" as new player
                                                            </div>
                                                            <div className="text-sm text-green-600">
                                                                This will create a new player record
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tournament Summary */}
                        {players.length > 0 && (
                            <div className="mb-6 p-4 bg-gray-50 rounded">
                                <h4 className="font-semibold text-black mb-2">Tournament Summary</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-black">Total Players:</span>
                                        <span className="ml-2 text-black font-medium">{players.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-black">New Players:</span>
                                        <span className="ml-2 font-medium text-black ">{players.filter(p => p.is_new_player).length}</span>
                                    </div>
                                    <div>
                                        <span className="text-black">With Placements:</span>
                                        <span className="ml-2 font-medium text-black ">{players.filter(p => p.placement !== null).length}</span>
                                    </div>
                                    <div>
                                        <span className="text-black">With Hitmen:</span>
                                        <span className="ml-2 font-medium text-black ">{players.filter(p => p.hitman_name !== null).length}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Players List */}
                        <div>
                            <div className="flex items-center gap-2">
                                <h3
                                    className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                    onClick={resetToDefaultSort}
                                    title={sortBy === 'insertion' ?
                                        `Click to sort ${sortOrder === 'desc' ? 'oldest first' : 'newest first'}` :
                                        'Click to sort by insertion order (newest first)'
                                    }
                                >
                                    Players ({players.length})
                                </h3>
                                {sortBy === 'insertion' && (
                                    <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                                        Insertion Order
                                        <span className="text-xs">
                                            {sortOrder === 'desc' ? '↓ Newest First' : '↑ Oldest First'}
                                        </span>
                                    </span>
                                )}
                            </div>

                            {players.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No players added yet. Start typing a name above to add players.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Column Headers */}
                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border-b-2 border-gray-300 bg-gray-50 font-semibold text-gray-700">
                                        <div
                                            className="flex items-center gap-1 cursor-pointer hover:text-blue-600"
                                            onClick={() => handleSort('name')}
                                        >
                                            Player Name
                                            {sortBy === 'name' && (
                                                <span className="text-xs">
                                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                        <div>Hitman</div>
                                        <div
                                            className="flex items-center gap-1 cursor-pointer hover:text-blue-600"
                                            onClick={() => handleSort('ko_position')}
                                        >
                                            KO Position
                                            {sortBy === 'ko_position' && (
                                                <span className="text-xs">
                                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                        <div>Final Position</div>
                                        <div>Status</div>
                                        <div>Actions</div>
                                    </div>


                                    {/* Show players in insertion order when sortBy is 'insertion', otherwise use sortPlayers */}
                                    {(sortBy === 'insertion' ?
                                        (sortOrder === 'desc' ? players : [...players].reverse()) : // desc = newest first, asc = oldest first
                                        sortPlayers(players)
                                    ).map((player) => (
                                        <div
                                            key={player.id}
                                            className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border rounded hover:bg-gray-50"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">
                                                    {player.player_name}
                                                </span>
                                                {player.is_new_player ? (
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                                        NEW
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={hitmanSearchValues[player.id] ?? player.hitman_name ?? ''}
                                                    onChange={(e) => handleHitmanSearchChange(player.id, e.target.value)}
                                                    onFocus={() => {
                                                        const currentValue = hitmanSearchValues[player.id] ?? player.hitman_name ?? '';
                                                        if (currentValue.length > 0) {
                                                            setHitmanDropdownVisible(prev => ({ ...prev, [player.id]: true }));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        // Delay hiding dropdown to allow for clicks
                                                        setTimeout(() => {
                                                            setHitmanDropdownVisible(prev => ({ ...prev, [player.id]: false }));
                                                        }, 200);
                                                    }}
                                                    className="w-full px-2 py-1 border rounded text-black text-sm"
                                                    placeholder="Type hitman name..."
                                                    disabled={currentDraft?.status === 'integrated'}
                                                />

                                                {/* Hitman Dropdown */}
                                                {hitmanDropdownVisible[player.id] && (
                                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto">
                                                        {getHitmanCandidates(player.id, hitmanSearchValues[player.id] ?? '').length === 0 ? (
                                                            <div className="px-3 py-2 text-gray-500 text-sm">
                                                                No matching players found
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {getHitmanCandidates(player.id, hitmanSearchValues[player.id] ?? '').map((candidate) => (
                                                                    <div
                                                                        key={candidate.id}
                                                                        onClick={() => selectHitman(player.id, candidate.player_name)}
                                                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                                                    >
                                                                        <div className="font-medium text-gray-900">
                                                                            {candidate.player_name}

                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {/* Clear hitman option */}
                                                                {(hitmanSearchValues[player.id] ?? player.hitman_name) && (
                                                                    <div
                                                                        onClick={() => selectHitman(player.id, '')}
                                                                        className="px-3 py-2 hover:bg-red-50 cursor-pointer border-t bg-red-25 text-red-600"
                                                                    >
                                                                        <div className="font-medium">
                                                                            Clear hitman
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <input
                                                    type="number"
                                                    value={player.ko_position || ''}
                                                    onChange={(e) => updatePlayer(player.id, 'ko_position', parseInt(e.target.value) || null)}
                                                    className="w-full px-2 py-1 border rounded text-black text-sm"
                                                    placeholder="KO Position"
                                                    disabled={currentDraft?.status === 'integrated'}
                                                />
                                            </div>

                                            <div>
                                                <input
                                                    type="number"
                                                    value={player.placement || ''}
                                                    onChange={(e) => updatePlayer(player.id, 'placement', parseInt(e.target.value) || null)}
                                                    className="w-full px-2 py-1 border rounded text-black text-sm"
                                                    placeholder="Final Position"
                                                    disabled={currentDraft?.status === 'integrated'}
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {player.placement === 1 && (
                                                    <span className="text-yellow-500">👑</span>
                                                )}
                                                {player.placement === 2 && (
                                                    <span className="text-gray-400">🥈</span>
                                                )}
                                                {player.placement === 3 && (
                                                    <span className="text-orange-600">🥉</span>
                                                )}
                                            </div>

                                            <div className="flex justify-end">
                                                {currentDraft?.status !== 'integrated' && (
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Remove ${player.player_name} from tournament?`)) {
                                                                removePlayer(player.id);
                                                            }
                                                        }}
                                                        className="text-red-600 hover:text-red-800 p-1"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}