// app/admin/tournament-entry/screens/Screen6_TableAssignment/useTableAssignment.ts

import { useState, useCallback, useMemo } from 'react';

const SEATS_PER_TABLE = 8;

export interface Player {
  id: number;
  player_name: string;
  player_uid: string | null;
  player_nickname?: string | null;
  is_new_player: boolean;
  hitman_name: string | null;
  ko_position: number | null;
  placement: number | null;
  t_assign?: number;
  photo_url?: string | null;
}

export interface DragState {
  playerId: number;
  fromTable: number;
}

export function useTableAssignment(
  draftId: number,
  initialPlayers: Player[],
  onDataChange: () => void
) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [additionalTables, setAdditionalTables] = useState(0);

  // Get only active (not knocked out) players
  const activePlayers = useMemo(
    () => players.filter((p) => p.ko_position === null || p.ko_position === 0),
    [players]
  );

  // Calculate table count from max t_assign among active players + any additional empty tables
  const tableCount = useMemo(() => {
    const maxAssigned = Math.max(0, ...activePlayers.map((p) => p.t_assign || 0));
    return Math.max(maxAssigned, additionalTables);
  }, [activePlayers, additionalTables]);

  // Group active players by table
  const playersByTable = useMemo(() => {
    const grouped: Record<number, Player[]> = {};
    for (let t = 1; t <= tableCount; t++) {
      grouped[t] = [];
    }
    for (const player of activePlayers) {
      const table = player.t_assign || 0;
      if (table > 0) {
        if (!grouped[table]) grouped[table] = [];
        grouped[table].push(player);
      }
    }
    return grouped;
  }, [activePlayers, tableCount]);

  // Get unassigned players (no table assignment)
  const unassignedPlayers = useMemo(
    () => activePlayers.filter((p) => !p.t_assign || p.t_assign === 0),
    [activePlayers]
  );

  // Handle drag start
  const handleDragStart = useCallback((playerId: number, fromTable: number) => {
    setDragging({ playerId, fromTable });
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragging(null);
  }, []);

  // Handle table reassignment (on drop)
  const handleTableReassign = useCallback(
    async (playerId: number, toTable: number) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return;

      const fromTable = player.t_assign || 0;
      if (fromTable === toTable) return;

      // Optimistic update
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, t_assign: toTable } : p))
      );

      try {
        const res = await fetch(
          `/api/tournament-drafts/${draftId}/players/${playerId}/table`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ t_assign: toTable }),
          }
        );

        if (!res.ok) {
          // Rollback on failure
          setPlayers((prev) =>
            prev.map((p) => (p.id === playerId ? { ...p, t_assign: fromTable } : p))
          );
          console.error('Table reassignment failed');
        } else {
          onDataChange();
        }
      } catch (error) {
        // Rollback on error
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, t_assign: fromTable } : p))
        );
        console.error('Table reassignment error:', error);
      }
    },
    [draftId, players, onDataChange]
  );

  // Add an empty table
  const addTable = useCallback(() => {
    setAdditionalTables((prev) => Math.max(tableCount + 1, prev + 1));
  }, [tableCount]);

  // Reset all table assignments
  const resetAllAssignments = useCallback(async () => {
    // Optimistic update - set all t_assign to 0
    const previousPlayers = [...players];
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, t_assign: 0 }))
    );
    setAdditionalTables(0);

    try {
      const res = await fetch(
        `/api/tournament-drafts/${draftId}/players/reset-tables`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!res.ok) {
        // Rollback on failure
        setPlayers(previousPlayers);
        console.error('Reset table assignments failed');
        return false;
      } else {
        onDataChange();
        return true;
      }
    } catch (error) {
      // Rollback on error
      setPlayers(previousPlayers);
      console.error('Reset table assignments error:', error);
      return false;
    }
  }, [draftId, players, onDataChange]);

  // Sync players when prop changes
  const syncPlayers = useCallback((newPlayers: Player[]) => {
    setPlayers(newPlayers);
  }, []);

  return {
    players,
    activePlayers,
    unassignedPlayers,
    tableCount,
    playersByTable,
    dragging,
    handleDragStart,
    handleDragEnd,
    handleTableReassign,
    addTable,
    resetAllAssignments,
    syncPlayers,
    SEATS_PER_TABLE,
  };
}
