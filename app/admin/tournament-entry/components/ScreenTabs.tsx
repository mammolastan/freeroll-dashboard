// app/admin/tournament-entry/components/ScreenTabs.tsx

'use client';

import React from 'react';
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

export function ScreenTabs({ currentScreen, onScreenChange }: ScreenTabsProps) {
  const screens: ScreenNumber[] = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center justify-center gap-1 mb-4">
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
  );
}
