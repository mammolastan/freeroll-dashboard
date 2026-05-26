// app/admin/tournament-entry/screens/Screen6_TableAssignment/OctagonTable.tsx

'use client';

import React, { useState } from 'react';
import { PlayerSeat } from './PlayerSeat';
import { EmptySeat } from './EmptySeat';

const SEATS_PER_TABLE = 8;

interface Player {
  id: number;
  player_name: string;
  player_nickname?: string | null;
  is_new_player: boolean;
  t_assign?: number;
  photo_url?: string | null;
}

interface OctagonTableProps {
  tableNumber: number;
  players: Player[];
  onDragStart: (playerId: number, fromTable: number) => void;
  onDragEnd: () => void;
  onDrop: (playerId: number, toTable: number) => void;
  onKnockout?: (player: { id: number; player_name: string }) => void;
  isDragging?: boolean;
}

/**
 * Calculate seat position around the octagon.
 * Seats are positioned at equal angles (45° apart) starting from top.
 */
function getSeatPosition(seatIndex: number, radius: number, cx: number, cy: number) {
  // Start at top (−90°), go clockwise
  const angle = ((seatIndex * 45) - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

/**
 * Generate SVG octagon path.
 */
function getOctagonPath(cx: number, cy: number, radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 8; i++) {
    // Offset by 22.5° so flat sides are at top/bottom
    const angle = ((i * 45) - 90 + 22.5) * (Math.PI / 180);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return `M${points.join('L')}Z`;
}

export function OctagonTable({
  tableNumber,
  players,
  onDragStart,
  onDragEnd,
  onDrop,
  onKnockout,
  isDragging,
}: OctagonTableProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  // Dimensions
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const octagonRadius = 80;
  const seatRadius = 110;

  const playerCount = players.length;
  const isFull = playerCount >= SEATS_PER_TABLE;

  return (
    <div
      className={`
        relative w-[280px] h-[280px]
        transition-all duration-200
        ${isDropTarget && isDragging ? 'scale-105' : ''}
      `}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDropTarget(true);
      }}
      onDragLeave={(e) => {
        // Only set false if leaving the container (not entering a child)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDropTarget(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const playerId = Number(e.dataTransfer.getData('playerId'));
        const fromTable = Number(e.dataTransfer.getData('fromTable'));
        if (playerId && fromTable !== tableNumber) {
          onDrop(playerId, tableNumber);
        }
        setIsDropTarget(false);
      }}
    >
      {/* SVG Octagon */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 w-full h-full"
      >
        {/* Glow filter */}
        <defs>
          <filter id={`glow-${tableNumber}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Octagon shape */}
        <path
          d={getOctagonPath(cx, cy, octagonRadius)}
          fill="#0f2029"
          stroke={isDropTarget && isDragging ? '#fbbf24' : '#00e5cc'}
          strokeWidth={isDropTarget && isDragging ? 3 : 1.5}
          filter={`url(#glow-${tableNumber})`}
          className="transition-all duration-200"
        />

        {/* Table label */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          className="fill-cyan-400 text-sm font-bold"
        >
          Table {tableNumber}
        </text>

        {/* Player count badge */}
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className={`text-xs font-mono ${isFull ? 'fill-red-400' : 'fill-gray-400'}`}
        >
          {playerCount}/{SEATS_PER_TABLE}
        </text>
      </svg>

      {/* Seats around the octagon */}
      {Array.from({ length: SEATS_PER_TABLE }).map((_, seatIndex) => {
        const position = getSeatPosition(seatIndex, seatRadius, cx, cy);
        const player = players[seatIndex];

        if (player) {
          return (
            <PlayerSeat
              key={player.id}
              player={player}
              position={position}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onKnockout={onKnockout}
            />
          );
        } else {
          return (
            <EmptySeat
              key={`empty-${seatIndex}`}
              seatNumber={seatIndex + 1}
              position={position}
              isDropTarget={isDropTarget && isDragging}
            />
          );
        }
      })}
    </div>
  );
}
