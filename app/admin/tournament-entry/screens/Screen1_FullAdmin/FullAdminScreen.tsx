// app/admin/tournament-entry/screens/Screen1_FullAdmin/FullAdminScreen.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Trophy, Calendar, MapPin, User, Plus, ArrowLeft, Check, X, ChevronDown, Download, QrCode } from 'lucide-react';
import { formatGameDate } from '@/lib/utils';
import { QRCodeModal } from '../../QRCodeModal';
import { GameTimer } from '@/components/Timer/GameTimer';
import { useRealtimeGameData } from '@/lib/realtime/hooks/useRealtimeGameData';
import { socket } from '@/lib/socketClient';
import { PlayerSearchDropdown } from '@/components/PlayerSearchDropdown';

// Blind schedule definitions
const BLIND_SCHEDULES = {
    standard: {
        id: 'standard',
        name: 'Standard Speed',
        description: '20-minute levels'
    },
    turbo: {
        id: 'turbo',
        name: 'Turbo Speed',
        description: '10-minute levels'
    }
};

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
    blind_schedule?: string;
}

interface PlayerSearchResult {
    Name: string;
    UID: string;
    nickname: string | null;
    TotalGames?: number;
    TotalPoints?: number;
}

interface Player {
    id: number;
    player_name: string;
    player_uid: string | null;
    is_new_player: boolean;
    hitman_name: string | null;
    ko_position: number | null;
    placement: number | null;
    added_by?: 'admin' | 'self_checkin';
    checked_in_at?: string;
    player_nickname?: string | null; // Optional field for nickname
}

interface FullAdminScreenProps {
    isAuthenticated: boolean;
    setIsAuthenticated: (value: boolean) => void;
    currentView: 'welcome' | 'entry';
    setCurrentView: (view: 'welcome' | 'entry') => void;
    currentDraft: TournamentDraft | null;
    players: Player[];
    onDraftChange: (draft: TournamentDraft | null) => void;
    onDataChange: () => void;
}

export function FullAdminScreen({
    isAuthenticated,
    setIsAuthenticated,
    currentView,
    setCurrentView,
    currentDraft: currentDraftProp,
    players,
    onDraftChange,
    onDataChange,
}: FullAdminScreenProps) {
    // Authentication
    const [password, setPassword] = useState('');

    // Tournament management
    const [tournaments, setTournaments] = useState<TournamentDraft[]>([]);
    const [currentDraft, setCurrentDraft] = useState<TournamentDraft | null>(currentDraftProp);
    const [loadingTournaments, setLoadingTournaments] = useState(false);
    const [showIntegrationPreview, setShowIntegrationPreview] = useState(false);
    const [displayCount, setDisplayCount] = useState(8);
    const [showLoadMore, setShowLoadMore] = useState(false);
    const [isReverting, setIsReverting] = useState(false);
    const { gameData, computedStats, loading: realtimeLoading, error: realtimeError } =
        useRealtimeGameData(currentDraft?.id || 0);



    // New tournament modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTournament, setNewTournament] = useState({
        tournament_date: '',
        director_name: '',
        venue: '',
        start_points: 0
    });

    // Player management (using props from parent)
    const [newPlayerName, setNewPlayerName] = useState('');
    const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchResult[]>([]);
    const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isIntegrating, setIsIntegrating] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'ko_position' | 'insertion' | 'checked_in_at'>('insertion');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // desc means newest first for insertion

    const [hitmanSearchValues, setHitmanSearchValues] = useState<{ [key: number]: string }>({});
    const [hitmanDropdownVisible, setHitmanDropdownVisible] = useState<{ [key: number]: boolean }>({});
    const [hitmanHighlightedIndex, setHitmanHighlightedIndex] = useState<Record<number, number>>({});

    // Debounce refs for player updates
    const globalUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingUpdatesRef = useRef<{ [key: number]: Partial<Player> }>({});
    const hasPendingChanges = Object.keys(pendingUpdatesRef.current).length > 0;

    // UI state for editing KO positions
    const [editingKOPlayers, setEditingKOPlayers] = useState(new Set());
    const [pendingSortUpdate, setPendingSortUpdate] = useState(false);

    const [skipNextAutoRefresh, setSkipNextAutoRefresh] = useState(false);
    const skipAutoRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Venue management
    const [venues, setVenues] = useState<string[]>([]);

    // Sync currentDraft with parent prop
    useEffect(() => {
        if (currentDraftProp?.id !== currentDraft?.id) {
            setCurrentDraft(currentDraftProp);
        }
    }, [currentDraftProp, currentDraft]);

    // Wrapper to update local state and notify parent
    const updateCurrentDraft = useCallback((draft: TournamentDraft | null) => {
        setCurrentDraft(draft);
        onDraftChange(draft);
    }, [onDraftChange]);

    // Socket.IO connection for real-time updates
    useEffect(() => {
        if (currentDraft) {
            console.log(`Joining room ${currentDraft.id} for admin page`);
            socket.emit('joinRoom', currentDraft.id.toString());
        }

        return () => {
            if (currentDraft) {
                socket.off('updatePlayers');
                socket.off('tournament:updated');
            }
        };
    }, [currentDraft]);
    const [showVenueDropdown, setShowVenueDropdown] = useState(false);
    const [isAddingNewVenue, setIsAddingNewVenue] = useState(false);
    const [newVenueInput, setNewVenueInput] = useState('');
    const [loadingVenues, setLoadingVenues] = useState(false);

    // checkin    
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [checkInUrl, setCheckInUrl] = useState<string>('');
    const [showQRCode, setShowQRCode] = useState(false);
    const [generatingQR, setGeneratingQR] = useState(false);


    // Load tournaments list
    const loadTournaments = async () => {
        setLoadingTournaments(true);
        try {
            const response = await fetch('/api/tournament-drafts');
            if (!response.ok) throw new Error('Failed to load tournaments');

            const data = await response.json();
            setTournaments(data);
            resetDisplayCount();
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
            updateCurrentDraft(tournament);
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
        clearTournamentState();
        updateCurrentDraft(tournament);
        setCurrentView('entry');
        // Players will be loaded by parent via onDraftChange
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

    // Load more tournaments handler
    const handleLoadMore = () => {
        setDisplayCount(prev => prev + 8);
    };

    // Reset display count when tournaments change
    const resetDisplayCount = () => {
        setDisplayCount(8);
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
                updateCurrentDraft({ ...currentDraft, [field]: value });
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


    const getFilteredAndSortedPlayers = () => {
        let filteredPlayers = players;

        // If we're in KO edit mode and there are players being edited, don't sort
        if (sortBy === 'ko_position' && editingKOPlayers.size > 0) {
            // Keep current order but still filter
            return filteredPlayers;
        }

        // Apply sorting
        return filteredPlayers.sort((a, b) => {
            if (sortBy === 'name') {
                const nameA = a.player_name.toLowerCase();
                const nameB = b.player_name.toLowerCase();
                return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            }

            if (sortBy === 'ko_position') {
                const koA = a.ko_position;
                const koB = b.ko_position;

                if (koA === null && koB === null) return 0;
                if (koA === null) return sortOrder === 'desc' ? -1 : 1;
                if (koB === null) return sortOrder === 'desc' ? 1 : -1;

                return sortOrder === 'asc' ? koA - koB : koB - koA;
            }

            if (sortBy === 'checked_in_at') {
                if (!a.checked_in_at && !b.checked_in_at) return 0;
                if (!a.checked_in_at) return sortOrder === 'asc' ? 1 : -1;
                if (!b.checked_in_at) return sortOrder === 'asc' ? -1 : 1;
                const dateA = new Date(a.checked_in_at).getTime();
                const dateB = new Date(b.checked_in_at).getTime();
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            }

            if (sortBy === 'insertion') {
                return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
            }

            return 0;
        });
    };

    // Handlers for KO input focus/blur
    const handleKOInputFocus = (playerId: number) => {
        if (sortBy === 'ko_position') {
            setEditingKOPlayers(prev => new Set([...prev, playerId]));
        }
    };

    const handleKOInputBlur = (playerId: number) => {
        setEditingKOPlayers(prev => {
            const newSet = new Set(prev);
            newSet.delete(playerId);
            return newSet;
        });

        // If no more players being edited, trigger a sort update
        if (editingKOPlayers.size === 1 && sortBy === 'ko_position') { // size will be 1 before deletion
            setPendingSortUpdate(true);
            setTimeout(() => {
                setPendingSortUpdate(false);
            }, 100);
        }
    };


    // Handle column header click for sorting
    const handleSort = (column: 'name' | 'ko_position' | 'checked_in_at') => {
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

    const clearTournamentState = () => {
        // Clear tournament data
        updateCurrentDraft(null);
        // Players will be cleared by parent via onDraftChange

        // Clear player input/search states
        setNewPlayerName('');
        setPlayerSearchResults([]);
        setShowPlayerDropdown(false);
        setIsSearching(false);

        // Clear hitman search states
        setHitmanSearchValues({});
        setHitmanDropdownVisible({});
        setHitmanHighlightedIndex({});

        // Clear integration/UI states
        setShowIntegrationPreview(false);
        setIsIntegrating(false);
        setIsReverting(false);

        // Clear check-in related states
        setLastUpdated(new Date());
        setCheckInUrl('');
        setShowQRCode(false);
        setGeneratingQR(false);

        console.log('Tournament state cleared');
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
    const addPlayer = async (playerData: { name: string; nickname?: string; uid?: string; isNew?: boolean }) => {
        if (!currentDraft) return;

        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_name: playerData.name,
                    player_nickname: playerData.nickname || null,
                    player_uid: playerData.uid || null,
                    is_new_player: playerData.isNew || false
                })
            });

            if (response.ok) {
                // Trigger parent to reload player data
                onDataChange();
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

    //  updatePlayer with debounce and batching
    const updatePlayer = useCallback(async (playerId: number, field: string, value: string | number | null) => {
        try {
            const player = players.find(p => p.id === playerId);
            if (!player) {
                console.error('Player not found:', playerId);
                return;
            }

            // Create updated player object
            let updatedPlayer = { ...player, [field]: value };

            // Auto-assign KO position when hitman is selected (same logic as before)
            if (field === 'hitman_name' && value) {
                const usedKoPositions = players
                    .filter(p => p.ko_position !== null && p.id !== playerId)
                    .map(p => p.ko_position!);

                const maxKoPosition = usedKoPositions.length > 0 ? Math.max(...usedKoPositions) : 0;
                const nextKoPosition = maxKoPosition + 1;
                updatedPlayer = { ...updatedPlayer, ko_position: nextKoPosition };
            }

            // Clear KO position if hitman is removed
            if (field === 'hitman_name' && !value) {
                updatedPlayer = { ...updatedPlayer, ko_position: null };
            }

            // Store pending updates for this player
            pendingUpdatesRef.current[playerId] = updatedPlayer;

            // Clear existing global timeout
            if (globalUpdateTimeoutRef.current) {
                clearTimeout(globalUpdateTimeoutRef.current);
            }

            // Set new global timeout to batch ALL pending updates
            globalUpdateTimeoutRef.current = setTimeout(async () => {
                const playersToUpdate = { ...pendingUpdatesRef.current };
                if (Object.keys(playersToUpdate).length === 0) return;

                console.log(`Batching updates for ${Object.keys(playersToUpdate).length} players`);

                try {
                    // Convert pending updates to array format for batch API
                    const updateArray = Object.entries(playersToUpdate).map(([playerIdStr, updatedData]) => ({
                        id: parseInt(playerIdStr),
                        ...updatedData
                    }));

                    // Send single batch request
                    const response = await fetch(`/api/tournament-drafts/${currentDraft?.id}/players/batch`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            players: updateArray
                        })
                    });

                    // ✅ NEW ERROR HANDLING
                    if (!response.ok) {
                        let errorMessage = "Failed to save changes";

                        try {
                            const errorData = await response.json();
                            errorMessage = errorData.userMessage || errorData.error || errorMessage;
                        } catch (jsonError) {
                            errorMessage = "Server error - Unable to save changes. Please refresh the page and try again.";
                        }

                        alert(`⚠️ Error Saving Changes\n\n${errorMessage}\n\nPlease try again. If the problem persists, contact support.`);

                        if (currentDraft) {
                            await loadPlayersForTournament(currentDraft.id);
                        }

                        console.error("Save failed:", response.status, errorMessage);
                        return;
                    }

                    // ✅ SUCCESS PATH
                    const result = await response.json();
                    temporarilyDisableAutoRefresh();

                    // Trigger parent to reload all player data
                    onDataChange();

                    console.log(`✅ Successfully batch updated ${result.updateCount} players`);

                } catch (error) {
                    console.error('Batch update error:', error);
                    alert(`⚠️ Network Error\n\nUnable to save changes. Please check your connection and try again.\n\nIf the problem persists, contact support.`);

                    if (currentDraft) {
                        loadPlayersForTournament(currentDraft.id);
                    }
                } finally {
                    // Clean up
                    pendingUpdatesRef.current = {};
                    globalUpdateTimeoutRef.current = null;
                }
            }, 1500);

        } catch (error) {
            console.error('Error in updatePlayer:', error);
        }
    }, [players, currentDraft]);

    // cleanup on component unmount
    useEffect(() => {
        return () => {
            // Clear pending timeout on unmount
            if (globalUpdateTimeoutRef.current) {
                clearTimeout(globalUpdateTimeoutRef.current);
            }
            globalUpdateTimeoutRef.current = null;
            pendingUpdatesRef.current = {};

            // Clear auto-refresh skip timeout
            if (skipAutoRefreshTimeoutRef.current) {
                clearTimeout(skipAutoRefreshTimeoutRef.current);
            }
        };
    }, []);

    // force immediate save
    const saveAllPendingUpdates = useCallback(async () => {
        if (globalUpdateTimeoutRef.current) {
            clearTimeout(globalUpdateTimeoutRef.current);
            globalUpdateTimeoutRef.current = null;

            const playersToUpdate = { ...pendingUpdatesRef.current };

            if (Object.keys(playersToUpdate).length === 0) {
                return { success: true, updatedCount: 0 };
            }

            console.log(`Force saving ${Object.keys(playersToUpdate).length} pending updates`);

            try {
                const updatePromises = Object.entries(playersToUpdate).map(async ([playerIdStr, updatedData]) => {
                    const playerId = parseInt(playerIdStr);

                    const response = await fetch(`/api/tournament-drafts/${currentDraft?.id}/players/${playerId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedData)
                    });

                    if (response.ok) {
                        const serverUpdatedPlayer = await response.json();
                        return { success: true, playerId, data: serverUpdatedPlayer };
                    } else {
                        const errorText = await response.text();
                        return { success: false, playerId, error: errorText };
                    }
                });

                const results = await Promise.allSettled(updatePromises);
                const successCount = results.filter(r =>
                    r.status === 'fulfilled' && r.value.success
                ).length;

                // Update UI with successful results
                const successfulUpdates = results
                    .filter((r): r is PromiseFulfilledResult<any> =>
                        r.status === 'fulfilled' && r.value.success
                    )
                    .map(r => r.value);

                if (successfulUpdates.length > 0) {
                    // Trigger parent to reload player data
                    onDataChange();
                }

                pendingUpdatesRef.current = {};

                return {
                    success: true,
                    updatedCount: successCount,
                    totalAttempted: Object.keys(playersToUpdate).length
                };
            } catch (error) {
                console.error('Error in force save:', error);
                return { success: false, error };
            }
        }

        return { success: true, updatedCount: 0 };
    }, [currentDraft, players]);

    // Auto-calculate KO positions to fix duplicates and gaps
    const autoCalculateKOPositions = async () => {
        if (!currentDraft) return;

        // Get all players with KO positions (knocked out players)
        const playersWithKO = players.filter(p => p.ko_position !== null);

        if (playersWithKO.length === 0) {
            alert('No players with KO positions found to fix.');
            return;
        }

        // Confirm the action
        if (!confirm(`This will automatically reassign KO positions for ${playersWithKO.length} players to fix duplicates and gaps. Continue?`)) {
            return;
        }

        try {
            // Sort players by current KO position, then alphabetically by name for consistency
            // This ensures a deterministic order when there are duplicates
            const sortedPlayers = [...playersWithKO].sort((a, b) => {
                if (a.ko_position === b.ko_position) {
                    // If KO positions are the same, sort alphabetically
                    return a.player_name.localeCompare(b.player_name);
                }
                return (a.ko_position || 0) - (b.ko_position || 0);
            });

            // Reassign KO positions sequentially starting from 1
            const updatePromises = sortedPlayers.map((player, index) => {
                const newKOPosition = index + 1;

                // Only update if the position actually changed
                if (player.ko_position !== newKOPosition) {
                    return updatePlayer(player.id, 'ko_position', newKOPosition);
                }
                return Promise.resolve();
            });

            // Wait for all updates to complete
            await Promise.all(updatePromises);

            alert(`Successfully reassigned KO positions for ${sortedPlayers.length} players.\nPositions are now sequential from 1 to ${sortedPlayers.length}.`);

            // Refresh the player data to ensure consistency
            if (currentDraft) {
                await loadPlayersForTournament(currentDraft.id);
            }

        } catch (error) {
            console.error('Error auto-calculating KO positions:', error);
            alert('Failed to auto-calculate KO positions. Please try again.');
        }
    };

    // Remove player
    const removePlayer = async (playerId: number) => {
        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft?.id}/players/${playerId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Trigger parent to reload player data
                onDataChange();
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
        const finalHitmanName = hitmanName === 'unknown' ? 'unknown' : hitmanName;
        updatePlayer(playerId, 'hitman_name', finalHitmanName || null);
        setHitmanSearchValues(prev => ({ ...prev, [playerId]: finalHitmanName }));
        setHitmanDropdownVisible(prev => ({ ...prev, [playerId]: false }));

    };

    // Handle hitman search input changes    
    const handleHitmanSearchChange = (playerId: number, value: string) => {
        setHitmanSearchValues(prev => ({ ...prev, [playerId]: value }));
        setHitmanDropdownVisible(prev => ({ ...prev, [playerId]: value.length > 0 }));
        setHitmanHighlightedIndex(prev => ({ ...prev, [playerId]: -1 }));

        // Only auto-update for exact player name matches during typing
        // Let the blur handler deal with "unknown" and other values
        const exactMatch = players.find(p =>
            p.id !== playerId &&
            p.player_name.toLowerCase() === value.toLowerCase()
        );

        if (exactMatch) {
            updatePlayer(playerId, 'hitman_name', exactMatch.player_name);
        }
    };

    const handleCrosshairClick = (playerId: number) => {
        const player = players.find(p => p.id === playerId);
        if (!player) return;

        // If player is already knocked out, clear knockout
        if (player.hitman_name && player.ko_position !== null) {
            const hitmanInput = document.getElementById(`hitman-input-${playerId}`) as HTMLInputElement;
            if (hitmanInput) {
                hitmanInput.value = '';
                console.log(`Directly set input field to empty for player ${playerId}`);
            }
            clearPlayerKnockout(playerId);
        } else {
            // if player is NOT knocked out, set hitman to "unknown" and trigger KO assignment
            setHitmanSearchValues(prev => ({ ...prev, [playerId]: 'unknown' }));

            setTimeout(() => {
                const hitmanInput = document.getElementById(`hitman-input-${playerId}`) as HTMLInputElement;
                if (hitmanInput) {
                    hitmanInput.focus();
                    hitmanInput.select();
                }
            }, 50);
        }
    };

    const clearPlayerKnockout = async (playerId: number) => {
        try {
            const player = players.find(p => p.id === playerId);
            if (!player) {
                console.error('Player not found:', playerId);
                return;
            }

            console.log(`Clearing knockout for player ${playerId}`);

            // Disable auto-refresh temporarily
            temporarilyDisableAutoRefresh();

            // Clear ALL related UI state for this player IMMEDIATELY
            setHitmanSearchValues(prev => ({
                ...prev,
                [playerId]: ''
            }));

            setHitmanDropdownVisible(prev => ({ ...prev, [playerId]: false }));
            setHitmanHighlightedIndex(prev => ({ ...prev, [playerId]: -1 }));

            // THEN use the debounced updatePlayer function for both fields
            await updatePlayer(playerId, 'hitman_name', null);
            await updatePlayer(playerId, 'ko_position', null);

        } catch (error) {
            console.error('Error clearing player knockout data:', error);
            alert(`Error clearing knockout data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleHitmanKeyDown = (playerId: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        const candidates = getHitmanCandidates(playerId, hitmanSearchValues[playerId] || '');
        const unknownOption = hitmanSearchValues[playerId] &&
            hitmanSearchValues[playerId].toLowerCase().includes('unknown');

        // Create full options list (candidates + unknown if applicable)
        const allOptions = [...candidates];
        if (unknownOption) {
            allOptions.push({ id: -1, player_name: 'unknown' } as any);
        }

        const currentHighlight = hitmanHighlightedIndex[playerId] ?? -1;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (hitmanDropdownVisible[playerId] && allOptions.length > 0) {
                    const nextIndex = currentHighlight < allOptions.length - 1 ? currentHighlight + 1 : 0;
                    setHitmanHighlightedIndex(prev => ({ ...prev, [playerId]: nextIndex }));
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (hitmanDropdownVisible[playerId] && allOptions.length > 0) {
                    const prevIndex = currentHighlight > 0 ? currentHighlight - 1 : allOptions.length - 1;
                    setHitmanHighlightedIndex(prev => ({ ...prev, [playerId]: prevIndex }));
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (hitmanDropdownVisible[playerId] && allOptions.length > 0 && currentHighlight >= 0) {
                    // Select the highlighted option
                    const selectedOption = allOptions[currentHighlight];
                    selectHitman(playerId, selectedOption.player_name);
                } else {
                    // No dropdown or no selection, just blur to trigger existing logic
                    const hitmanInput = document.getElementById(`hitman-input-${playerId}`) as HTMLInputElement;
                    if (hitmanInput) {
                        hitmanInput.blur();
                    }
                }
                break;

            case 'Escape':
                e.preventDefault();
                setHitmanDropdownVisible(prev => ({ ...prev, [playerId]: false }));
                setHitmanHighlightedIndex(prev => ({ ...prev, [playerId]: -1 }));
                break;
        }
    };

    // Hitman input focus handler:
    const handleHitmanFocus = (playerId: number) => {
        const player = players.find(p => p.id === playerId);
        if (!player) return;

        const currentValue = hitmanSearchValues[playerId] ?? player.hitman_name ?? '';

        // If this is a fresh knockout (selected via button), the value should already be "unknown"
        // If user manually clicks the input, set to "unknown" if empty
        if (currentValue === '') {
            setHitmanSearchValues(prev => ({ ...prev, [playerId]: 'unknown' }));
            setTimeout(() => {
                const hitmanInput = document.getElementById(`hitman-input-${playerId}`) as HTMLInputElement;
                if (hitmanInput) {
                    hitmanInput.select();
                }
            }, 50);
        }

        setHitmanDropdownVisible(prev => ({ ...prev, [playerId]: true }));
        setHitmanHighlightedIndex(prev => ({ ...prev, [playerId]: -1 }));
    };

    // hitman input blur handler:
    const handleHitmanBlur = (playerId: number) => {
        // Hide dropdown when losing focus
        setTimeout(() => {
            setHitmanDropdownVisible(prev => ({ ...prev, [playerId]: false }));
        }, 150); // Small delay to allow dropdown clicks to register

        const currentValue = hitmanSearchValues[playerId] ?? '';

        // Process the final value when user leaves the input
        if (currentValue.toLowerCase() === 'unknown' || currentValue === 'unknown') {
            // Treat "unknown" as a valid hitman and trigger KO position assignment
            updatePlayer(playerId, 'hitman_name', 'unknown');
        } else if (currentValue === '') {
            // Clear hitman if empty
            updatePlayer(playerId, 'hitman_name', null);
        } else {
            // Check if it matches an exact player name
            const exactMatch = players.find(p =>
                p.id !== playerId &&
                p.player_name.toLowerCase() === currentValue.toLowerCase()
            );

            if (exactMatch) {
                updatePlayer(playerId, 'hitman_name', exactMatch.player_name);
            } else {
                // If it doesn't match any player, treat it as a custom hitman name
                updatePlayer(playerId, 'hitman_name', currentValue);
            }
        }
    };

    // Export tournament
    const exportTournament = () => {
        if (!currentDraft || players.length === 0) return;
        const sortedPlayers = [...players].sort((a, b) => {
            if (a.ko_position !== null && b.ko_position !== null) {
                return a.ko_position - b.ko_position;
            }
            if (a.ko_position !== null) return -1;
            if (b.ko_position !== null) return 1;
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

        // Validate before attempting integration
        const validation = validateTournamentForIntegration(players);
        if (!validation.canIntegrate) {
            alert(`Cannot integrate tournament:\n\n${validation.errors.join('\n')}`);
            return;
        }

        if (!confirm(`Ready to integrate tournament with ${players.length} players?\n\nThis will calculate final placements based on KO positions and cannot be undone.`)) {
            return;
        }

        setIsIntegrating(true);

        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/integrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();
                alert(`Tournament integrated successfully!\n\nFile: ${result.fileName}\nPlayers: ${result.playersIntegrated}\n\nPlacements calculated based on KO positions.`);

                // Refresh tournament data
                loadTournaments();
                setCurrentView('welcome');
            } else {
                const errorData = await response.json();
                alert(`Integration failed: ${errorData.details || errorData.error}`);
            }
        } catch (error) {
            console.error('Integration error:', error);
            alert('Integration failed due to network error');
        } finally {
            setIsIntegrating(false);
        }
    };

    // Auto-calculate placement when KO positions change
    const updatePlayerWithPlacementCalculation = async (playerId: number, field: string, value: string | number | null) => {
        // Update the player as before
        await updatePlayer(playerId, field, value);

        // If KO position changed, show validation status update
        if (field === 'ko_position' || field === 'hitman_name') {
            // The validation component will automatically re-render and show updated status
            console.log('KO positions updated, validation status will refresh');
        }
    };

    // Reload players from parent (replaced local load with parent callback)
    const loadPlayersForTournament = async (tournamentId: number) => {
        // Trigger parent to reload player data
        onDataChange();
        setLastUpdated(new Date());  // Track when data was last refreshed
    };

    // Generate QR code function
    const generateCheckInQR = async () => {
        if (!currentDraft) return;

        setGeneratingQR(true);
        const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const newCheckInUrl = `${baseURL}/gameview/${currentDraft.id}`;
        setCheckInUrl(newCheckInUrl);
        setShowQRCode(true);
        setGeneratingQR(false);
    };

    //render player indicators
    const renderPlayerIndicator = (player: Player) => {
        if (player.added_by === 'self_checkin') {
            return (
                <span
                    className="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2"
                    title={`Self checked-in at ${player.checked_in_at ? new Date(player.checked_in_at).toLocaleTimeString() : 'unknown time'}`}
                ></span>
            );
        }
        return null;
    };
    // Validation function for tournament integration readiness
    const validateTournamentForIntegration = (players: Player[]): { canIntegrate: boolean; validationMessage: string; errors: string[] } => {
        const errors: string[] = [];

        // Check minimum players
        if (players.length < 2) {
            errors.push("Tournament must have at least 2 players");
        }

        // Check that all players have either a KO position or are the survivor
        const playersWithKoPosition = players.filter(p => p.ko_position !== null);
        const survivorPlayers = players.filter(p => p.ko_position === null);

        // Must have exactly one survivor (winner)
        if (survivorPlayers.length === 0) {
            errors.push("Tournament must have exactly 1 winner (player with no KO position)");
        } else if (survivorPlayers.length > 1) {
            const survivorNames = survivorPlayers.map(p => p.player_name).join(", ");
            errors.push(`Only 1 player can be the winner (no KO position). Found ${survivorPlayers.length}: ${survivorNames}`);
        }

        // All other players must have KO positions
        if (playersWithKoPosition.length !== players.length - 1) {
            const missingKO = players.filter(p => p.ko_position === null && survivorPlayers.length > 0 && !survivorPlayers.includes(p));
            if (missingKO.length > 0) {
                errors.push(`Players missing KO positions: ${missingKO.map(p => p.player_name).join(", ")}`);
            }
        }

        // KO positions must be sequential starting from 1
        if (playersWithKoPosition.length > 0) {
            const koPositions = playersWithKoPosition.map(p => p.ko_position!).sort((a, b) => a - b);
            const expectedPositions = Array.from({ length: koPositions.length }, (_, i) => i + 1);

            const missingPositions = expectedPositions.filter(pos => !koPositions.includes(pos));
            if (missingPositions.length > 0) {
                errors.push(`Missing KO positions: ${missingPositions.join(", ")}. Must be sequential from 1 to ${koPositions.length}`);
            }
        }

        // Check for duplicate KO positions
        const koPositionCounts = new Map<number, string[]>();
        playersWithKoPosition.forEach(p => {
            const playersList = koPositionCounts.get(p.ko_position!) || [];
            playersList.push(p.player_name);
            koPositionCounts.set(p.ko_position!, playersList);
        });

        for (const [position, playerNames] of koPositionCounts) {
            if (playerNames.length > 1) {
                errors.push(`Duplicate KO position ${position}: ${playerNames.join(", ")}`);
            }
        }

        // Check that players with hitman have KO positions
        const playersWithHitmanButNoKO = players.filter(p =>
            p.hitman_name !== null &&
            p.hitman_name !== '' &&
            p.ko_position === null
        );
        if (playersWithHitmanButNoKO.length > 0) {
            errors.push(`Players with hitman must have KO positions: ${playersWithHitmanButNoKO.map(p => p.player_name).join(", ")}`);
        }

        const isValid = errors.length === 0;

        return {
            canIntegrate: isValid,
            validationMessage: isValid
                ? `✅ Tournament ready for integration with ${players.length} players`
                : `❌ Cannot integrate tournament`,
            errors
        };
    };

    // Preview what placements will be calculated
    const previewPlacements = (players: Player[]): Array<{ name: string; koPosition: number | null; finalPlacement: number; hitman: string | null }> => {
        const knockedOutPlayers = players.filter(p => p.ko_position !== null);
        const survivorPlayers = players.filter(p => p.ko_position === null);

        return players.map(player => {
            let finalPlacement: number;

            if (player.ko_position === null) {
                // Survivor = Winner = 1st place
                finalPlacement = 1;
            } else {
                // Convert KO position to final placement
                // Highest KO position = 2nd place
                // 2nd highest KO position = 3rd place, etc.
                finalPlacement = (knockedOutPlayers.length - player.ko_position) + 2;
            }

            return {
                name: player.player_name,
                koPosition: player.ko_position,
                finalPlacement,
                hitman: player.hitman_name
            };
        }).sort((a, b) => a.finalPlacement - b.finalPlacement);
    };
    // Add this component to display validation status
    const TournamentValidationStatus = ({ players, onIntegrate, isIntegrating }: {
        players: Player[];
        onIntegrate: () => void;
        isIntegrating: boolean;
    }) => {
        const validation = validateTournamentForIntegration(players);
        const placementPreview = validation.canIntegrate ? previewPlacements(players) : [];

        // Check if there are KO position issues that can be auto-fixed
        const playersWithKO = players.filter(p => p.ko_position !== null);
        const hasKOPositionIssues = validation.errors.some(error =>
            error.includes('Duplicate KO position') ||
            error.includes('Must be sequential from 1 to')
        );

        return (
            <div className="mb-6 p-4 border rounded-lg">
                <h3 className="font-semibold text-lg mb-3">Integration Status</h3>

                <div className={`p-3 rounded-lg mb-4 ${validation.canIntegrate ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className={`font-medium ${validation.canIntegrate ? 'text-green-800' : 'text-red-800'}`}>
                        {validation.validationMessage}
                    </div>

                    {/* Auto-calculate button for KO position issues */}
                    {!validation.canIntegrate && hasKOPositionIssues && playersWithKO.length > 0 && (
                        <button
                            onClick={autoCalculateKOPositions}
                            disabled={currentDraft?.status === 'integrated'}
                            className="mt-3 mr-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Auto-Calculate KO #s
                        </button>
                    )}

                    {validation.canIntegrate && (
                        <button
                            onClick={onIntegrate}
                            disabled={isIntegrating || currentDraft?.status === 'integrated'}
                            className="mt-3 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <Trophy className="h-4 w-4" />
                            {isIntegrating ? 'Integrating...' : 'Integrate Tournament'}
                        </button>
                    )}

                    {!validation.canIntegrate && (
                        <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc list-inside space-y-1">
                                {validation.errors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {validation.canIntegrate && placementPreview.length > 0 && (
                    <div className="bg-blue-50 border-blue-200 text-black rounded-lg p-3">
                        <h4 className="font-medium text-blue-800 mb-2">Final Placement Preview:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                            {placementPreview.map((player, index) => (
                                <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                                    <span className="font-medium">
                                        {player.name}
                                    </span>
                                    <div className="text-right text-xs text-gray-600">
                                        <div>Place: {player.finalPlacement}</div>
                                        {player.koPosition && <div>KO #{player.koPosition}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };



    const revertIntegration = async () => {
        if (!currentDraft || currentDraft.status !== 'integrated') {
            alert('Cannot revert: Tournament is not integrated');
            return;
        }

        const confirmMessage = `⚠️ REVERT INTEGRATION ⚠️

                    This will:
                    • Delete all entries from the main database for this tournament
                    • Remove any new players that were created (if they don't appear in other tournaments)
                    • Restore the tournament to draft status for editing
                    • Allow you to make changes and re-integrate

                    This action affects the main tournament database. Are you sure you want to proceed?

                    Tournament: ${currentDraft.venue} - ${currentDraft.tournament_date}
                    Players: ${players.length}`;

        if (!confirm(confirmMessage)) {
            return;
        }

        setIsReverting(true);

        try {
            const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/revert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();

                alert(`Integration reverted successfully!

                    Deleted ${result.entriesDeleted} main database entries
                    Removed ${result.newPlayersRemoved} new players
                    Tournament restored to draft status

                    You can now edit the tournament and re-integrate when ready.`);

                // Refresh tournament data
                await loadTournaments();

                // Reload the current tournament to get updated status
                const updatedDraft = tournaments.find(t => t.id === currentDraft.id);
                if (updatedDraft) {
                    updateCurrentDraft({ ...updatedDraft, status: 'in_progress' });
                }

                // Stay on the current tournament page but refresh
                setCurrentView('entry');
            } else {
                const errorData = await response.json();
                alert(`Revert failed: ${errorData.details || errorData.error}`);
            }
        } catch (error) {
            console.error('Revert error:', error);
            alert('Revert failed due to network error');
        } finally {
            setIsReverting(false);
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

    // Load tournaments and venues on authentication
    useEffect(() => {
        if (isAuthenticated) {
            loadTournaments();
            loadVenues();
        }
    }, [isAuthenticated]);

    // manage load more button visibility
    useEffect(() => {
        setShowLoadMore(tournaments.length > displayCount);
    }, [tournaments.length, displayCount]);

    // Show create modal 
    useEffect(() => {
        if (showCreateModal) {
            setNewTournament(prev => ({
                ...prev,
                tournament_date: getTodayDateString()
            }));
        }
    }, [showCreateModal]);

    // smart polling functionality
    useEffect(() => {
        if (!currentDraft || currentDraft.status !== 'in_progress') return;

        // Refresh when tab becomes active
        const handleVisibilityChange = () => {
            if (!document.hidden && currentDraft && !skipNextAutoRefresh) {
                loadPlayersForTournament(currentDraft.id);
            }
        };

        // Poll every 15 seconds when tab is active
        const interval = setInterval(() => {
            if (!document.hidden && currentDraft && !skipNextAutoRefresh) {
                console.log('Auto-refreshing player data');
                loadPlayersForTournament(currentDraft.id);
            } else if (skipNextAutoRefresh) {
                console.log('Skipping auto-refresh due to recent update');
            }
        }, 15000);

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentDraft, skipNextAutoRefresh]);

    // Helper function to temporarily disable auto-refresh after updates
    const temporarilyDisableAutoRefresh = () => {
        setSkipNextAutoRefresh(true);

        // Clear any existing timeout
        if (skipAutoRefreshTimeoutRef.current) {
            clearTimeout(skipAutoRefreshTimeoutRef.current);
        }

        // Re-enable auto-refresh after 5 seconds (enough time for updates to complete)
        skipAutoRefreshTimeoutRef.current = setTimeout(() => {
            setSkipNextAutoRefresh(false);
            console.log('Re-enabled auto-refresh after update');
        }, 5000);
    };



    // Pre-Authentication UI
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
                                    <p className="text-gray-500 text-sm">Click &quot;Create New Tournament&quot; to get started.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {tournaments.slice(0, displayCount).map((tournament) => (
                                        <div
                                            key={tournament.id}
                                            className="p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                        >
                                            <div className='text-black text-sm'>
                                                {tournament.id}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div
                                                    className="flex items-center gap-4 flex-1 cursor-pointer"
                                                    onClick={() => selectTournament(tournament)}
                                                >
                                                    <div className="flex flex-col">

                                                        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                                            <Calendar className="w-4 h-4 text-blue-600" />
                                                            {formatGameDate(tournament.tournament_date || '')}
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
                                    {/* Load More Button */}
                                    {showLoadMore && (
                                        <div className="flex justify-center mt-6">
                                            <button
                                                onClick={handleLoadMore}
                                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                <Plus size={16} />
                                                Load More Tournaments ({tournaments.length - displayCount} remaining)
                                            </button>
                                        </div>
                                    )}
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
            {hasPendingChanges && (
                <div className="text-yellow-600 fixed text-sm">
                    ⏳ Saving changes...
                </div>
            )}
            {editingKOPlayers.size > 0 && sortBy === 'ko_position' && (
                <div className="mb-2 p-2 bg-amber-50 border border-amber-200 fixed rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700">
                        <span className="text-sm">✏️ Edit Mode:</span>
                        <span className="text-sm">List sorting paused while editing KO positions</span>
                    </div>
                </div>
            )}
            <div className="max-w-6xl mx-auto">
                <Card className="mb-6">
                    <CardHeader>

                    </CardHeader>
                    <CardContent>
                        {/* Tournament Status */}
                        {currentDraft && (
                            <div className="mb-6">
                                {/* // Action Buttons */}
                                <div className='flex flex-row gap-2'>
                                    <button
                                        onClick={() => {
                                            clearTournamentState();
                                            setCurrentView('welcome')
                                        }
                                        }
                                        className="flex items-center gap-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                                    >
                                        <ArrowLeft size={16} />
                                        Back to Tournaments
                                    </button>

                                    <button
                                        onClick={exportTournament}
                                        className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                    >
                                        <Download size={16} />
                                        Export
                                    </button>

                                    {/* QR Code */}
                                    {currentDraft?.status === 'in_progress' && (
                                        <button
                                            onClick={generateCheckInQR}
                                            disabled={generatingQR}
                                            className="flex items-center gap-2  px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <QrCode className="h-4 w-4" />
                                            {generatingQR ? 'Generating...' : 'QR'}
                                        </button>
                                    )}
                                </div>

                                {/* Tournament Info Header */}
                                <div className="flex items-center justify-between my-5">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            {currentDraft?.venue} - {formatGameDate(currentDraft?.tournament_date || '')}
                                        </h2>
                                        <p className="text-gray-600">
                                            Director: {currentDraft?.director_name} | Players: {players.length}
                                        </p>
                                    </div>

                                    {/* Buttons and info */}
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm text-gray-500">

                                            <div>Last updated: {lastUpdated.toLocaleTimeString()}</div>
                                            <div className="flex items-center gap-1 mt-1">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                Auto-refreshing
                                            </div>
                                        </div>


                                    </div>


                                </div>

                                {/* Status Banner */}
                                {currentDraft && (
                                    <div className={`p-3 flex flex-row justify-between gap-11 rounded-lg mb-4 ${currentDraft.status === 'integrated'
                                        ? 'bg-green-50 border border-green-200'
                                        : 'bg-blue-50 border border-blue-200'
                                        }`}>
                                        <div>
                                            <span className={`font-medium ${currentDraft.status === 'integrated' ? 'text-green-900' : 'text-blue-900'
                                                }`}>
                                                Status: {currentDraft.status.charAt(0).toUpperCase() + currentDraft.status.slice(1)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className={`text-sm ${currentDraft.status === 'integrated' ? 'text-green-700' : 'text-blue-700'
                                                }`}>
                                                {currentDraft.status === 'integrated'
                                                    ? '✅ Tournament completed and integrated'
                                                    : '🔄 Tournament in progress - players can check in'
                                                }
                                            </span>
                                            {currentDraft.status === 'integrated' &&
                                                (
                                                    <div className="mt-3 space-y-2">
                                                        <div className="text-sm text-blue-700">
                                                            ✅ This tournament has been integrated into the main system.
                                                        </div>
                                                        <div className="flex items-center gap-3 pt-2 border-t border-blue-200">
                                                            <button
                                                                onClick={revertIntegration}
                                                                disabled={isReverting}
                                                                className="flex items-center gap-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded text-sm transition-colors"
                                                            >
                                                                {isReverting ? (
                                                                    <>
                                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                        Reverting...
                                                                    </>) :
                                                                    (
                                                                        <>
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                                                            </svg>
                                                                            Revert to Draft
                                                                        </>
                                                                    )
                                                                }
                                                            </button>
                                                            <span className="text-xs text-orange-700">
                                                                ⚠️ This will delete main database entries and restore draft status
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            {currentDraft.status === 'in_progress' &&
                                                (
                                                    <div className="mt-2 text-sm text-blue-700">
                                                        📝 Draft mode - You can add/edit players and then integrate when ready.
                                                    </div>
                                                )
                                            }

                                        </div>
                                        {/* Integration Preview */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowIntegrationPreview(!showIntegrationPreview)}
                                                disabled={players.length === 0 || currentDraft?.status === 'integrated'}
                                                className={`px-3 py-1 text-sm flex items-center gap-2 ${players.length > 0 && currentDraft?.status !== 'integrated'
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                                    }`}
                                            >
                                                <Trophy className="h-4 w-4" />
                                                {currentDraft?.status === 'integrated'
                                                    ? 'Already Integrated'
                                                    : showIntegrationPreview
                                                        ? 'Hide Integration Preview'
                                                        : 'Preview Integration'
                                                }
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {showQRCode && (
                            <QRCodeModal checkInUrl={checkInUrl} showQRCode={showQRCode} setShowQRCode={setShowQRCode} currentDraft={currentDraft} />
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
                                        <PlayerSearchDropdown
                                            searchResults={playerSearchResults}
                                            isSearching={isSearching}
                                            checkedInPlayers={players.map(p => ({
                                                player_uid: p.player_uid,
                                                player_name: p.player_name
                                            }))}
                                            onSelectPlayer={(player) => addPlayer({ name: player.Name, nickname: player.nickname ?? undefined, uid: player.UID })}
                                            onAddNewPlayer={(name) => addPlayer({ name, isNew: true })}
                                            showAddNewOption={true}
                                            newPlayerName={newPlayerName}
                                        />
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
                                        <span className="text-black">Players Remaining:</span>
                                        <span className="ml-2 text-black font-medium">{players.length - players.filter(p => p.hitman_name !== null).length}</span>
                                    </div>
                                    <div>
                                        <span className="text-black">New Players:</span>
                                        <span className="ml-2 font-medium text-black ">{players.filter(p => p.is_new_player).length}</span>
                                    </div>
                                    <div>
                                        <span className="text-black">With Hitmen:</span>
                                        <span className="ml-2 font-medium text-black ">{players.filter(p => p.hitman_name !== null).length}</span>
                                    </div>
                                    <div>
                                        <span className="text-black">With Placements:</span>
                                        <span className="ml-2 font-medium text-black ">{players.filter(p => p.placement !== null).length}</span>
                                    </div>
                                </div>
                            </div>
                        )}





                        {showIntegrationPreview && players.length > 0 && currentDraft?.status !== 'integrated' && (
                            <TournamentValidationStatus
                                players={players}
                                onIntegrate={integrateToMainSystem}
                                isIntegrating={isIntegrating}
                            />
                        )}


                        {/* Blind Schedule Selector & Game Timer */}
                        {currentDraft && (
                            <div className="mb-6">
                                {/* Blind Schedule Selector */}
                                <Card className="mb-4">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Blind Schedule</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-4">
                                            <label className="text-sm font-medium text-gray-700">
                                                Schedule Type:
                                            </label>
                                            <select
                                                value={currentDraft.blind_schedule || 'standard'}
                                                onChange={async (e) => {
                                                    const newSchedule = e.target.value;
                                                    try {
                                                        const response = await fetch(`/api/tournament-drafts/${currentDraft.id}`, {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ blind_schedule: newSchedule })
                                                        });

                                                        if (response.ok) {
                                                            if (currentDraft) {
                                                                updateCurrentDraft({ ...currentDraft, blind_schedule: newSchedule });
                                                            }
                                                            // Reset timer when schedule changes
                                                            socket.emit('timer:reset', { tournamentId: currentDraft.id });
                                                        } else {
                                                            console.error('Failed to update blind schedule');
                                                        }
                                                    } catch (error) {
                                                        console.error('Error updating blind schedule:', error);
                                                    }
                                                }}
                                                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                disabled={currentDraft.status === 'integrated'}
                                            >
                                                {Object.values(BLIND_SCHEDULES).map(schedule => (
                                                    <option key={schedule.id} value={schedule.id}>
                                                        {schedule.name} - {schedule.description}
                                                    </option>
                                                ))}
                                            </select>
                                            {currentDraft.status === 'integrated' && (
                                                <span className="text-sm text-gray-500">
                                                    Cannot change schedule for integrated tournaments
                                                </span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Game Timer */}
                                <GameTimer tournamentId={currentDraft.id} playersRemaining={computedStats?.playersRemaining} isAdmin={true} />
                            </div>
                        )}

                        {/* Players List */}
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <h3
                                        className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                        onClick={resetToDefaultSort}
                                        title={sortBy === 'insertion' ?
                                            `Click to sort ${sortOrder === 'desc' ? 'oldest first' : 'newest first'}` :
                                            'Click to sort by insertion order (newest first)'
                                        }
                                    >
                                        Players ({getFilteredAndSortedPlayers().length})
                                    </h3>
                                    {sortBy === 'insertion' && (
                                        <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                                            Insertion Order
                                            <span className="text-xs">
                                                {sortOrder === 'desc' ? '↓' : '↑'}
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {getFilteredAndSortedPlayers().length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No players added yet. Start typing a name above to add players.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Column Headers */}
                                    <div className="grid grid-cols-1 md:grid-cols-[3fr,1fr,2fr,1fr,1fr] gap-2 p-3 border-b-2 border-gray-300 bg-gray-50 font-semibold text-gray-700">
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
                                        <div
                                            className='cursor-pointer hover:text-blue-600'
                                            onClick={() => handleSort('checked_in_at')}
                                        >
                                            Time
                                            {sortBy === 'checked_in_at' && (
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
                                            KO #
                                            {sortBy === 'ko_position' && (
                                                <span className="text-xs">
                                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-center">Actions</div>
                                    </div>

                                    {/* Player Rows */}
                                    {getFilteredAndSortedPlayers().map((player) => (
                                        <div
                                            key={player.id}
                                            className={`grid grid-cols-1 md:grid-cols-[3fr,1fr,2fr,1fr,1fr] gap-2 p-3 border-b ${player.hitman_name && player.ko_position !== null
                                                ? 'bg-red-50 border-red-100'
                                                : 'bg-white'
                                                }`}
                                        >
                                            {/* Player Name Column */}
                                            <div className="flex items-center gap-2 ">
                                                <div className="flex items-center gap-2 flex-1">

                                                    <span className="font-medium text-gray-900">
                                                        {player.player_name} {player.player_nickname ? `(${player.player_nickname})` : ''}
                                                    </span>
                                                    {renderPlayerIndicator(player)}
                                                    {player.is_new_player ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                                            NEW
                                                        </span>
                                                    ) : ''}
                                                </div>

                                            </div>
                                            {/* Checkintime Column */}
                                            <div>
                                                <div>
                                                    <p className='text-black text-sm'>{player.checked_in_at ? new Date(player.checked_in_at).toLocaleTimeString() : ''} </p>
                                                </div>
                                            </div>
                                            {/* Hitman Input Column */}
                                            <div className="relative flex">
                                                {/* Knockout/Clear Button */}
                                                {currentDraft?.status !== 'integrated' ? (
                                                    <button
                                                        onClick={() => handleCrosshairClick(player.id)}
                                                        className={`ml-2 p-1 rounded-full transition-colors ${player.hitman_name && player.ko_position !== null
                                                            ? 'text-green-600 hover:text-green-800 hover:bg-green-50' // Green when both assigned
                                                            : 'text-red-600 hover:text-red-800 hover:bg-red-50'       // Red when not assigned
                                                            }`}
                                                        title={
                                                            player.hitman_name && player.ko_position !== null
                                                                ? `Clear knockout data for ${player.player_name} (Hitman: ${player.hitman_name}, KO#: ${player.ko_position})`
                                                                : `Knockout ${player.player_name}`
                                                        }
                                                    >
                                                        <svg
                                                            width="18"
                                                            height="18"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="12" y1="0" x2="12" y2="8" />
                                                            <line x1="12" y1="16" x2="12" y2="24" />
                                                            <line x1="0" y1="12" x2="8" y2="12" />
                                                            <line x1="16" y1="12" x2="24" y2="12" />
                                                            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                                                        </svg>
                                                    </button>
                                                ) : ''}
                                                <input
                                                    id={`hitman-input-${player.id}`}
                                                    type="text"
                                                    value={hitmanSearchValues[player.id] ?? player.hitman_name ?? ''}
                                                    onChange={(e) => handleHitmanSearchChange(player.id, e.target.value)}
                                                    onFocus={() => handleHitmanFocus(player.id)}
                                                    onBlur={() => handleHitmanBlur(player.id)}
                                                    onKeyDown={(e) => handleHitmanKeyDown(player.id, e)}
                                                    className={`w-full px-2 py-1 border rounded text-black text-sm ${currentDraft?.status === 'integrated' ? 'bg-gray-100' : ''
                                                        }`}
                                                    placeholder="Enter hitman name or leave as 'unknown'"
                                                    disabled={currentDraft?.status === 'integrated'}
                                                />


                                                {/* Hitman dropdown */}
                                                {hitmanDropdownVisible[player.id] && currentDraft?.status !== 'integrated' && (
                                                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-10 max-h-32 overflow-y-auto">
                                                        {(() => {
                                                            const candidates = getHitmanCandidates(player.id, hitmanSearchValues[player.id] || '');
                                                            const unknownOption = hitmanSearchValues[player.id] &&
                                                                hitmanSearchValues[player.id].toLowerCase().includes('unknown');
                                                            const allOptions = [...candidates];
                                                            if (unknownOption) {
                                                                allOptions.push({ id: -1, player_name: 'unknown' } as any);
                                                            }
                                                            const highlightedIndex = hitmanHighlightedIndex[player.id] ?? -1;

                                                            return (
                                                                <>
                                                                    {candidates.map((candidate, index) => (
                                                                        <div
                                                                            key={candidate.id}
                                                                            onClick={() => selectHitman(player.id, candidate.player_name)}
                                                                            className={`px-2 py-1 cursor-pointer text-black text-sm ${index === highlightedIndex
                                                                                ? 'bg-blue-200 text-blue-900'
                                                                                : 'hover:bg-blue-100'
                                                                                }`}
                                                                        >
                                                                            {candidate.player_name}
                                                                        </div>
                                                                    ))}
                                                                    {/* Add "unknown" option if user is typing */}
                                                                    {unknownOption && (
                                                                        <div
                                                                            onClick={() => selectHitman(player.id, 'unknown')}
                                                                            className={`px-2 py-1 cursor-pointer text-black text-sm border-t ${candidates.length === highlightedIndex
                                                                                ? 'bg-blue-200 text-blue-900'
                                                                                : 'hover:bg-blue-100'
                                                                                }`}
                                                                        >
                                                                            <em>unknown hitman</em>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>

                                            {/* KO Position Column */}
                                            <div>
                                                <input
                                                    type="number"
                                                    value={player.ko_position || ''}
                                                    onChange={(e) => updatePlayer(player.id, 'ko_position', parseInt(e.target.value) || null)}
                                                    onFocus={() => handleKOInputFocus(player.id)}
                                                    onBlur={() => handleKOInputBlur(player.id)}
                                                    className="w-full px-2 py-1 border rounded text-black text-sm"
                                                    placeholder="KO #"
                                                    min={0}
                                                    disabled={currentDraft?.status === 'integrated'}
                                                />
                                            </div>

                                            {/* Remove Button Column */}
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
        </div >
    );
}