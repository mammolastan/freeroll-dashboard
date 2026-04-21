// app/admin/tournament-entry/screens/Screen6_TableAssignment/TableMap.tsx

'use client';

import React from 'react';
import { OctagonTable } from './OctagonTable';

interface Player {
  id: number;
  player_name: string;
  player_nickname?: string | null;
  is_new_player: boolean;
  t_assign?: number;
  photo_url?: string | null;
}

interface TableMapProps {
  tableCount: number;
  playersByTable: Record<number, Player[]>;
  onDragStart: (playerId: number, fromTable: number) => void;
  onDragEnd: () => void;
  onDrop: (playerId: number, toTable: number) => void;
  onKnockout?: (player: { id: number; player_name: string }) => void;
  isDragging: boolean;
}

export function TableMap({
  tableCount,
  playersByTable,
  onDragStart,
  onDragEnd,
  onDrop,
  onKnockout,
  isDragging,
}: TableMapProps) {
  if (tableCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
        No tables yet. Add players to create tables automatically.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div
        className="grid gap-6 justify-center"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        }}
      >
        {Array.from({ length: tableCount }).map((_, index) => {
          const tableNumber = index + 1;
          const players = playersByTable[tableNumber] || [];

          return (
            <div
              key={tableNumber}
              className="flex items-center justify-center"
            >
              <OctagonTable
                tableNumber={tableNumber}
                players={players}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
                onKnockout={onKnockout}
                isDragging={isDragging}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
