// app/admin/tournament-entry/components/ScreenTabs.tsx

'use client';

import React from 'react';
import { ClipboardList, Timer, UserCheck, X, MessageSquare } from 'lucide-react';
import { ScreenNumber } from '../hooks/useScreenRouter';

interface ScreenTabsProps {
  currentScreen: ScreenNumber;
  onScreenChange: (screen: ScreenNumber) => void;
}

const SCREEN_LABELS: Record<ScreenNumber, string> = {
  1: 'Admin',
  2: 'Timer',
  3: 'Check-In',
  4: 'Control',
  5: 'Messages',
};

const SCREEN_ICONS: Record<ScreenNumber, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  1: ClipboardList,
  2: Timer,
  3: UserCheck,
  4: X,
  5: MessageSquare,
};

export function ScreenTabs({ currentScreen, onScreenChange }: ScreenTabsProps) {
  const screens: ScreenNumber[] = [1, 2, 3, 4, 5];

  return (
    <>
      {/* Mobile: horizontal number tabs, sticky below navbar */}
      <div className="flex items-center justify-center gap-1 pb-2 pt-2 md:hidden sticky top-16 z-40">
        {screens.map((screen) => {
          const isActive = currentScreen === screen;
          return (
            <button
              key={screen}
              onClick={() => onScreenChange(screen)}
              className={`
                flex items-center justify-center rounded-lg font-bold transition-all duration-200
                ${isActive
                  ? 'bg-cyan-500 text-white px-4 py-2 text-lg shadow-lg shadow-cyan-500/30 scale-110'
                  : 'bg-gray-700 text-gray-300 px-3 py-1.5 text-sm hover:bg-gray-600 hover:text-white'
                }
              `}
              title={SCREEN_LABELS[screen]}
            >
              {screen}
            </button>
          );
        })}
      </div>

      {/* Desktop: vertical notebook divider tabs on left side */}
      <div className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 flex-col z-50">
        {screens.map((screen) => {
          const isActive = currentScreen === screen;
          return (
            <button
              key={screen}
              onClick={() => onScreenChange(screen)}
              className={`
                relative h-28 transition-all duration-200 border border-gray-600 border-l-0
                ${isActive
                  ? 'w-10 bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 rounded-r-md'
                  : 'w-7 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white hover:w-9 rounded-r-sm'
                }
              `}
            >
              <span
                className={`
                  absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  whitespace-nowrap font-bold tracking-wide inline-flex items-center gap-2
                  ${isActive ? 'text-xs' : 'text-[10px]'}
                `}
                style={{ writingMode: 'vertical-rl', transform: 'translate(-50%, -50%) rotate(180deg)' }}
              >
                {SCREEN_LABELS[screen]}
                {React.createElement(SCREEN_ICONS[screen], {
                  size: isActive ? 36 : 30,
                  className: 'shrink-0 inline',
                  style: { transform: 'rotate(180deg)' },
                })}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
