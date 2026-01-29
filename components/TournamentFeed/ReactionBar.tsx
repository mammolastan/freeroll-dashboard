// components/TournamentFeed/ReactionBar.tsx

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SuitCounts, ReactionType } from '@/types';

interface ReactionBarProps {
  itemId: string;
  totals: SuitCounts;
  mine?: SuitCounts;
  balance: SuitCounts | null;
  canReact: boolean;
  onReact: (itemId: string, reactionType: ReactionType, count: number) => void;
}

const SUITS: { type: ReactionType; filled: string; hollow: string; color: string }[] = [
  { type: 'club', filled: '\u2663', hollow: '\u2667', color: 'text-green-400' },
  { type: 'diamond', filled: '\u2666', hollow: '\u2662', color: 'text-blue-400' },
  { type: 'heart', filled: '\u2665', hollow: '\u2661', color: 'text-red-400' },
  { type: 'spade', filled: '\u2660', hollow: '\u2664', color: 'text-gray-300' },
];

const DEBOUNCE_MS = 3000;

// Flyaway particle that animates up and fades out
function FlyawayParticle({ suit, count, onDone }: { suit: typeof SUITS[number]; count: number; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 600);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <span
      className={`absolute pointer-events-none ${suit.color} font-bold text-sm`}
      style={{
        animation: 'flyaway 600ms ease-out forwards',
        left: '50%',
        bottom: '100%',
      }}
    >
      {suit.filled}{count > 1 ? ` x${count}` : ''}
      <style>{`
        @keyframes flyaway {
          0% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -20px) scale(0.7); }
        }
      `}</style>
    </span>
  );
}

export function ReactionBar({ itemId, totals, mine, balance, canReact, onReact }: ReactionBarProps) {
  // Track pending (not yet submitted) taps per suit
  const [pendingCounts, setPendingCounts] = useState<Partial<Record<ReactionType, number>>>({});
  // Track timer progress for the countdown indicator (0 to 1)
  const [timerProgress, setTimerProgress] = useState<Partial<Record<ReactionType, number>>>({});
  // Track flyaway animations per suit
  const [flyaways, setFlyaways] = useState<Partial<Record<ReactionType, { id: number; count: number }>>>({});
  const flyawayIdRef = useRef(0);
  const debounceTimers = useRef<Partial<Record<ReactionType, ReturnType<typeof setTimeout>>>>({});
  const animationFrames = useRef<Partial<Record<ReactionType, number>>>({});
  const timerStarts = useRef<Partial<Record<ReactionType, number>>>({});

  // Use refs for stable references in timeout callbacks
  const onReactRef = useRef(onReact);
  const itemIdRef = useRef(itemId);
  const pendingCountsRef = useRef(pendingCounts);
  onReactRef.current = onReact;
  itemIdRef.current = itemId;
  pendingCountsRef.current = pendingCounts;

  // Cleanup on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    const frames = animationFrames.current;
    return () => {
      for (const suit of SUITS) {
        if (timers[suit.type]) {
          clearTimeout(timers[suit.type]);
        }
        if (frames[suit.type]) {
          cancelAnimationFrame(frames[suit.type]!);
        }
      }
    };
  }, []);

  const startTimerAnimation = useCallback((suit: ReactionType) => {
    timerStarts.current[suit] = Date.now();

    const animate = () => {
      const elapsed = Date.now() - (timerStarts.current[suit] || 0);
      const progress = Math.min(elapsed / DEBOUNCE_MS, 1);
      setTimerProgress(prev => ({ ...prev, [suit]: progress }));

      if (progress < 1) {
        animationFrames.current[suit] = requestAnimationFrame(animate);
      }
    };

    if (animationFrames.current[suit]) {
      cancelAnimationFrame(animationFrames.current[suit]!);
    }
    animationFrames.current[suit] = requestAnimationFrame(animate);
  }, []);

  const handleTap = useCallback((suit: ReactionType) => {
    if (!canReact) return;

    // Check if user has remaining balance for this suit (accounting for already-pending taps)
    setPendingCounts(prev => {
      const currentPending = prev[suit] || 0;
      const remaining = (balance?.[suit] ?? 0) - currentPending;
      if (remaining <= 0) return prev;

      // Increment pending count
      const newPending = { ...prev, [suit]: currentPending + 1 };

      // Reset/restart the debounce timer
      if (debounceTimers.current[suit]) {
        clearTimeout(debounceTimers.current[suit]);
      }

      // Restart the timer animation
      startTimerAnimation(suit);

      debounceTimers.current[suit] = setTimeout(() => {
        // Read the count from the ref (avoids stale closure) and submit
        const count = pendingCountsRef.current[suit] || 0;
        // Clear pending state
        setPendingCounts(current => ({ ...current, [suit]: 0 }));
        setTimerProgress(p => ({ ...p, [suit]: 0 }));
        if (animationFrames.current[suit]) {
          cancelAnimationFrame(animationFrames.current[suit]!);
        }
        // Trigger flyaway animation
        if (count > 0) {
          const flyId = ++flyawayIdRef.current;
          setFlyaways(prev => ({ ...prev, [suit]: { id: flyId, count } }));
          onReactRef.current(itemIdRef.current, suit, count);
        }
      }, DEBOUNCE_MS);

      return newPending;
    });
  }, [canReact, balance, startTimerAnimation]);

  const clearFlyaway = useCallback((suit: ReactionType) => {
    setFlyaways(prev => ({ ...prev, [suit]: undefined }));
  }, []);

  return (
    <div className="flex items-center gap-3 pt-1.5">
      {SUITS.map(suit => {
        const pending = pendingCounts[suit.type] || 0;
        const total = (totals[suit.type] || 0) + pending;
        const myCount = (mine?.[suit.type] || 0) + pending;
        const hasReacted = myCount > 0;
        const remaining = (balance?.[suit.type] ?? 0) - pending;
        const isDisabled = !canReact || remaining <= 0;
        const progress = timerProgress[suit.type] || 0;
        const flyaway = flyaways[suit.type];

        return (
          <button
            key={suit.type}
            onClick={() => handleTap(suit.type)}
            disabled={isDisabled}
            className={`relative flex items-center gap-1 text-sm transition-all rounded px-1.5 py-0.5 ${
              hasReacted
                ? `${suit.color} bg-gray-800/60`
                : total > 0
                  ? suit.color
                  : 'text-gray-600 hover:text-gray-400'
            } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-800/40 active:scale-95'}`}
            title={canReact ? `${suit.type} (${remaining} left)` : 'Log in to react'}
          >
            {/* Flyaway animation on send */}
            {flyaway && (
              <FlyawayParticle
                key={flyaway.id}
                suit={suit}
                count={flyaway.count}
                onDone={() => clearFlyaway(suit.type)}
              />
            )}
            {/* Timer indicator - small circular countdown */}
            {pending > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5">
                <svg viewBox="0 0 20 20" className="w-full h-full -rotate-90">
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className={suit.color}
                    opacity={0.3}
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className={suit.color}
                    strokeDasharray={`${(1 - progress) * 50.27} 50.27`}
                  />
                </svg>
              </span>
            )}
            <span className="text-base leading-none">
              {total > 0 || hasReacted ? suit.filled : suit.hollow}
            </span>
            {total > 0 && (
              <span className="text-xs tabular-nums">{total}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
