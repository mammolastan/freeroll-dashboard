// app/admin/tournament-entry/screens/Screen6_TableAssignment/EmptySeat.tsx

'use client';

import React from 'react';

interface EmptySeatProps {
  seatNumber: number;
  position: { x: number; y: number };
  isDropTarget?: boolean;
}

export function EmptySeat({ seatNumber, position, isDropTarget }: EmptySeatProps) {
  return (
    <div
      className="absolute flex flex-col items-center pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Empty seat circle (dashed outline) */}
      <div
        className={`
          w-10 h-10 rounded-full
          border-2 border-dashed transition-all duration-200
          flex items-center justify-center
          ${isDropTarget
            ? 'border-yellow-400 bg-yellow-500/20'
            : 'border-cyan-500/30 bg-transparent'
          }
        `}
      >
        <span className="text-[10px] text-cyan-500/40 font-mono">{seatNumber}</span>
      </div>
    </div>
  );
}
