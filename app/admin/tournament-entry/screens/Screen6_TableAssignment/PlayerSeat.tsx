// app/admin/tournament-entry/screens/Screen6_TableAssignment/PlayerSeat.tsx

'use client';

import React from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';

interface PlayerSeatProps {
  player: {
    id: number;
    player_name: string;
    player_nickname?: string | null;
    is_new_player: boolean;
    t_assign?: number;
    photo_url?: string | null;
  };
  position: { x: number; y: number };
  onDragStart: (playerId: number, fromTable: number) => void;
  onDragEnd: () => void;
  onKnockout?: (player: { id: number; player_name: string }) => void;
}

export function PlayerSeat({
  player,
  position,
  onDragStart,
  onDragEnd,
  onKnockout,
}: PlayerSeatProps) {
  const displayName = player.player_nickname || player.player_name;
  const shortName = displayName.length > 10 ? displayName.slice(0, 9) + '…' : displayName;
  const hasPhoto = player.photo_url && player.photo_url.trim() !== '';

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('playerId', String(player.id));
        e.dataTransfer.setData('fromTable', String(player.t_assign || 0));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(player.id, player.t_assign || 0);
      }}
      onDragEnd={onDragEnd}
      className="absolute flex flex-col items-center cursor-grab active:cursor-grabbing group"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
      title={`${player.player_name}${player.is_new_player ? ' (New)' : ''}`}
    >
      {/* Avatar circle */}
      <div className="relative">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center overflow-hidden
            border-2 transition-all duration-200
            ${player.is_new_player
              ? 'border-yellow-400'
              : 'border-cyan-400'
            }
            ${!hasPhoto && (player.is_new_player ? 'bg-yellow-500/20' : 'bg-cyan-500/20')}
            group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(0,229,204,0.5)]
          `}
        >
          {hasPhoto ? (
            <Image
              src={player.photo_url!}
              alt={player.player_name}
              width={40}
              height={40}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <User size={20} className={player.is_new_player ? 'text-yellow-300' : 'text-cyan-300'} />
          )}
        </div>

        {/* Knockout button (visible on hover) */}
        {onKnockout && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKnockout(player);
            }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white
                       text-xs font-bold flex items-center justify-center
                       opacity-0 group-hover:opacity-100 transition-opacity
                       hover:bg-red-500 hover:scale-110"
            title="Knockout player"
          >
            ×
          </button>
        )}
      </div>

      {/* Player name */}
      <div
        className={`
          mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-center
          max-w-[70px] truncate
          ${player.is_new_player
            ? 'bg-yellow-500/30 text-yellow-200'
            : 'bg-gray-800/80 text-gray-200'
          }
        `}
      >
        {shortName}
      </div>
    </div>
  );
}
