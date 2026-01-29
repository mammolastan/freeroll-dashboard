// components/TournamentFeed/ReactionBalance.tsx

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SuitCounts } from '@/types';

interface ReactionBalanceProps {
  balance: SuitCounts;
}

const SUITS = [
  { type: 'club' as const, symbol: '\u2663', color: 'text-green-400' },
  { type: 'diamond' as const, symbol: '\u2666', color: 'text-blue-400' },
  { type: 'heart' as const, symbol: '\u2665', color: 'text-red-400' },
  { type: 'spade' as const, symbol: '\u2660', color: 'text-gray-300' },
];

// Split-flap style rolling number
function RollingNumber({ value, color }: { value: number; color: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (prev === value) return;

    // Animate: roll through intermediate numbers
    const diff = prev - value;
    if (diff <= 0) {
      // Value went up — just set immediately
      setDisplayValue(value);
      return;
    }

    // Value went down — roll through each number
    setIsAnimating(true);
    let current = prev;
    const stepDuration = Math.min(150, 400 / diff); // faster if many steps

    const step = () => {
      current--;
      setDisplayValue(current);
      if (current > value) {
        setTimeout(step, stepDuration);
      } else {
        setIsAnimating(false);
      }
    };

    // Small delay before starting the roll
    setTimeout(step, 80);
  }, [value]);

  return (
    <span className="relative inline-block text-center overflow-hidden">
      <span
        className={`inline-block tabular-nums transition-transform ${
          isAnimating ? 'animate-flap' : ''
        }`}
        style={{
          // When animating, briefly translate down then snap back
          ...(isAnimating ? {
            animation: 'splitflap 120ms ease-in-out',
          } : {}),
        }}
      >
        {displayValue}
      </span>
      <style>{`
        @keyframes splitflap {
          0% { transform: translateY(0); opacity: 1; }
          40% { transform: translateY(60%); opacity: 0.3; }
          60% { transform: translateY(-40%); opacity: 0.3; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

export function ReactionBalance({ balance }: ReactionBalanceProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-xs">
      <span className="text-gray-500">Reactions:</span>
      {SUITS.map(suit => (
        <span
          key={suit.type}
          className={`flex items-center gap-0.5 ${
            `${suit.color} ${balance[suit.type] === 0 ? 'opacity-50' : ''}`
          }`}
        >
          <span className="text-sm leading-none">{suit.symbol}</span>
          <RollingNumber value={balance[suit.type]} color={suit.color} />
        </span>
      ))}
    </div>
  );
}
