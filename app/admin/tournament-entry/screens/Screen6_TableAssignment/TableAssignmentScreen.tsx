// app/admin/tournament-entry/screens/Screen6_TableAssignment/TableAssignmentScreen.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Users, Target, X, UserPlus, Trophy } from 'lucide-react';
import { ScreenTabs } from '../../components/ScreenTabs';
import { ScreenNumber } from '../../hooks/useScreenRouter';
import { TableMap } from './TableMap';
import { useTableAssignment } from './useTableAssignment';
import { PlayerCheckInCore } from '@/components/PlayerCheckIn/PlayerCheckInCore';

interface TournamentDraft {
  id: number;
  tournament_date: string;
  director_name: string;
  title?: string | null;
  venue: string | null;
  venue_id: number | null;
  start_points: number;
  status: 'in_progress' | 'finalized' | 'integrated';
  created_at: string;
  updated_at: string;
  player_count: number;
  blind_schedule?: string;
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
  player_nickname?: string | null;
  t_assign?: number;
}

interface TableAssignmentScreenProps {
  currentDraft: TournamentDraft | null;
  players: Player[];
  onDataChange: () => void;
  currentScreen: ScreenNumber;
  onScreenChange: (screen: ScreenNumber) => void;
}

export function TableAssignmentScreen({
  currentDraft,
  players: propPlayers,
  onDataChange,
  currentScreen,
  onScreenChange,
}: TableAssignmentScreenProps) {
  const [knockoutTarget, setKnockoutTarget] = useState<Player | null>(null);
  const [hitmanSearch, setHitmanSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddPlayerPanel, setShowAddPlayerPanel] = useState(false);

  const {
    activePlayers,
    tableCount,
    playersByTable,
    dragging,
    handleDragStart,
    handleDragEnd,
    handleTableReassign,
    addTable,
    syncPlayers,
    SEATS_PER_TABLE,
  } = useTableAssignment(
    currentDraft?.id || 0,
    propPlayers,
    onDataChange
  );

  // Sync players when props change
  useEffect(() => {
    syncPlayers(propPlayers);
  }, [propPlayers, syncPlayers]);

  // Handle knockout
  const handleKnockout = useCallback(
    async (hitmanName: string) => {
      if (!currentDraft || !knockoutTarget || isSubmitting) return;

      setIsSubmitting(true);
      try {
        // Calculate next knockout position
        const maxKoPosition = Math.max(
          0,
          ...propPlayers.map((p) => p.ko_position || 0)
        );
        const nextKoPosition = maxKoPosition + 1;

        const response = await fetch(
          `/api/tournament-drafts/${currentDraft.id}/players/${knockoutTarget.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Screen': 'TableAssignment',
            },
            body: JSON.stringify({
              player_name: knockoutTarget.player_name,
              hitman_name: hitmanName || 'unknown',
              ko_position: nextKoPosition,
            }),
          }
        );

        if (response.ok) {
          setKnockoutTarget(null);
          setHitmanSearch('');
          onDataChange();
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Failed to record knockout');
        }
      } catch (error) {
        console.error('Error recording knockout:', error);
        alert('Error recording knockout. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentDraft, knockoutTarget, isSubmitting, propPlayers, onDataChange]
  );

  // Filter hitman options (other active players, searches both name and nickname)
  const hitmanOptions = activePlayers
    .filter((p) => knockoutTarget && p.id !== knockoutTarget.id)
    .filter((p) => {
      if (!hitmanSearch) return true;
      const searchText = hitmanSearch.toLowerCase();
      return (
        p.player_name.toLowerCase().includes(searchText) ||
        (p.player_nickname && p.player_nickname.toLowerCase().includes(searchText))
      );
    });

  // Handle adding a new player
  const handleAddPlayer = useCallback(
    async (playerData: {
      player_name: string;
      player_uid: string | null;
      is_new_player: boolean;
      player_nickname?: string | null;
    }) => {
      if (!currentDraft) throw new Error('No active tournament');

      const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Screen': 'TableAssignment',
        },
        body: JSON.stringify({ ...playerData, added_by: 'admin' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add player');
      }

      onDataChange();
    },
    [currentDraft, onDataChange]
  );

  // Get knocked out players sorted by most recent knockout first
  const knockedOutPlayers = propPlayers
    .filter((p) => p.ko_position !== null && p.ko_position > 0)
    .sort((a, b) => (b.ko_position || 0) - (a.ko_position || 0));

  // Calculate placement based on ko_position
  const calculatePlacement = (player: Player): number | null => {
    if (player.ko_position === null) return null;
    return propPlayers.length - player.ko_position + 1;
  };

  // Handle undo knockout
  const handleUndoKnockout = useCallback(
    async (player: Player) => {
      if (!currentDraft || isSubmitting) return;

      if (!confirm(`Undo knockout for ${player.player_name}?`)) return;

      setIsSubmitting(true);
      try {
        const response = await fetch(
          `/api/tournament-drafts/${currentDraft.id}/players/${player.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Screen': 'TableAssignment',
            },
            body: JSON.stringify({
              player_name: player.player_name,
              hitman_name: null,
              ko_position: null,
            }),
          }
        );

        if (response.ok) {
          onDataChange();
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Failed to undo knockout');
        }
      } catch (error) {
        console.error('Error undoing knockout:', error);
        alert('Error undoing knockout. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentDraft, isSubmitting, onDataChange]
  );

  if (!currentDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cyan-300 mb-4">
            No Active Tournament
          </h1>
          <p className="text-gray-400 text-lg">
            Please create or select a tournament on Screen 1 (Full Admin)
          </p>
          <div className="mt-8 text-sm text-gray-500">
            Press 1 to go to Full Admin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col relative">
      {/* Screen Navigation Tabs */}
      <ScreenTabs currentScreen={currentScreen} onScreenChange={onScreenChange} />

      {/* Header */}
      <div className="p-6 text-center">
        <h1 className="text-4xl font-bold text-cyan-300 mb-2 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
          Table Assignment
        </h1>
        <p className="text-lg text-gray-400">
          {currentDraft.title || currentDraft.venue || 'Tournament'}
        </p>

        {/* Stats bar */}
        <div className="flex items-center justify-center gap-4 mt-4 text-sm flex-wrap">
          <div className="flex items-center gap-2 text-green-400">
            <Users size={18} />
            <span>{activePlayers.length} Active</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-400">
            <span>{tableCount} Table{tableCount !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={addTable}
            className="flex items-center gap-1 px-3 py-1 rounded bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600/50 transition-colors border border-cyan-500/50"
          >
            <Plus size={16} />
            Add Table
          </button>
          <button
            onClick={() => setShowAddPlayerPanel(true)}
            className="flex items-center gap-1 px-3 py-1 rounded bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 transition-colors border border-purple-500/50"
          >
            <UserPlus size={16} />
            Add Player
          </button>
        </div>
      </div>

      {/* Table Map */}
      <TableMap
        tableCount={tableCount}
        playersByTable={playersByTable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrop={handleTableReassign}
        onKnockout={(player) => setKnockoutTarget(player as Player)}
        isDragging={dragging !== null}
      />

      {/* Knocked Out Players Section */}
      {knockedOutPlayers.length > 0 && (
        <div className="border-t border-gray-700">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-900/80 flex items-center gap-2 text-red-400">
            <Trophy size={20} />
            <span className="font-semibold">Knocked Out ({knockedOutPlayers.length})</span>
          </div>

          {/* Knocked Out List */}
          <div className="bg-gray-900/60 px-4 py-2">
            <div className="space-y-2">
              {knockedOutPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-gray-800/60 border border-red-500/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-red-400 font-bold text-sm">
                      #{player.ko_position}
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {player.player_name}
                        {player.player_nickname && (
                          <span className="text-cyan-400 ml-1">({player.player_nickname})</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        {player.hitman_name && (
                          <>
                            <Target size={10} />
                            <span>by {player.hitman_name}</span>
                            <span className="mx-1">•</span>
                          </>
                        )}
                        <span>Placed #{calculatePlacement(player)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUndoKnockout(player)}
                    disabled={isSubmitting}
                    className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded border border-yellow-500/50 transition-all disabled:opacity-50"
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Player Slide-out Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full sm:w-[420px] bg-gray-900/98 border-l-2 border-purple-500/50
          transform transition-transform duration-300 ease-in-out z-50
          ${showAddPlayerPanel ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/30">
          <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2">
            <UserPlus size={22} />
            Add Player
          </h2>
          <button
            onClick={() => setShowAddPlayerPanel(false)}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Panel Content */}
        <div className="p-4 overflow-y-auto h-[calc(100%-64px)]">
          <PlayerCheckInCore
            players={propPlayers}
            onCheckIn={handleAddPlayer}
            onSuccess={() => {
              onDataChange();
              // Optionally close panel after success, or keep open for rapid entry
              // setShowAddPlayerPanel(false);
            }}
            showRecentlyCheckedIn={false}
          />
        </div>
      </div>

      {/* Backdrop when panel is open */}
      {showAddPlayerPanel && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowAddPlayerPanel(false)}
        />
      )}

      {/* Player Action Modal (Knockout + Move Table) */}
      {knockoutTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-cyan-500 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Player Info Header */}
            <div className="mb-6 text-center">
              <div className="text-xl font-bold text-white mb-1">
                {knockoutTarget.player_name}
                {knockoutTarget.player_nickname && (
                  <span className="text-cyan-400 ml-2">({knockoutTarget.player_nickname})</span>
                )}
              </div>
              <div className="text-gray-400">
                Currently at Table {knockoutTarget.t_assign || 'Unassigned'}
              </div>
            </div>

            {/* Move to Table Section */}
            {tableCount > 1 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                  <Users size={18} />
                  Move to Table
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: tableCount }).map((_, index) => {
                    const tableNum = index + 1;
                    const isCurrentTable = tableNum === knockoutTarget.t_assign;
                    const playersAtTable = playersByTable[tableNum]?.length || 0;
                    const isFull = playersAtTable >= SEATS_PER_TABLE;

                    return (
                      <button
                        key={tableNum}
                        onClick={async () => {
                          if (!isCurrentTable && !isFull) {
                            await handleTableReassign(knockoutTarget.id, tableNum);
                            setKnockoutTarget(null);
                            setHitmanSearch('');
                          }
                        }}
                        disabled={isCurrentTable || isFull}
                        className={`
                          px-4 py-3 rounded-lg font-bold text-lg min-w-[60px] transition-all
                          ${isCurrentTable
                            ? 'bg-cyan-600 text-white cursor-default'
                            : isFull
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-700 text-white hover:bg-cyan-600 hover:scale-105 active:scale-95'
                          }
                        `}
                      >
                        <div>{tableNum}</div>
                        <div className={`text-xs font-normal ${isFull ? 'text-red-400' : 'text-gray-400'}`}>
                          {playersAtTable}/{SEATS_PER_TABLE}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-700 my-4" />

            {/* Knockout Section */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                <Target size={18} />
                Record Knockout
              </h3>
              <div className="text-sm text-gray-400 mb-2">
                Placement: #{activePlayers.length}
              </div>
              <label className="block text-gray-300 mb-2 text-sm">
                Who knocked them out? (Enter for &quot;unknown&quot;)
              </label>
              <input
                type="text"
                value={hitmanSearch}
                onChange={(e) => setHitmanSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleKnockout(hitmanSearch.trim() || 'unknown');
                  } else if (e.key === 'Escape') {
                    setKnockoutTarget(null);
                    setHitmanSearch('');
                  }
                }}
                placeholder="Type to search or press Enter..."
                className="w-full px-3 py-2 bg-gray-800 border border-red-500/50 rounded text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-form-type="other"
                data-lpignore="true"
              />

              {hitmanSearch && hitmanOptions.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto bg-gray-800 border border-red-500/50 rounded">
                  {hitmanOptions.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleKnockout(p.player_name)}
                      className="w-full px-3 py-2 text-left text-white hover:bg-gray-700"
                    >
                      {p.player_name}
                      {p.player_nickname && (
                        <span className="text-cyan-400 ml-2">({p.player_nickname})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => handleKnockout(hitmanSearch.trim() || 'unknown')}
                disabled={isSubmitting}
                className="w-full mt-3 px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Target size={18} />
                Confirm Knockout
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                setKnockoutTarget(null);
                setHitmanSearch('');
              }}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <X size={18} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
