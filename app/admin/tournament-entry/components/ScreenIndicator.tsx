// app/admin/tournament-entry/components/ScreenIndicator.tsx

'use client';

import React from 'react';
import { ScreenNumber } from '../hooks/useScreenRouter';

interface ScreenIndicatorProps {
  currentScreen: ScreenNumber;
}

const SCREEN_NAMES: Record<ScreenNumber, string> = {
  1: 'Full Admin',
  2: 'Game Timer',
  3: 'Player Check-In',
  4: 'Player Control',
  5: 'TD Messages',
};

export function ScreenIndicator({ currentScreen }: ScreenIndicatorProps) {
  // Hide indicator on Screen 1 (Full Admin)
  if (currentScreen === 1) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
      <div className="flex items-center gap-2">
        <span className="font-bold text-lg">Screen {currentScreen}</span>
        <span className="text-sm opacity-90">{SCREEN_NAMES[currentScreen]}</span>
      </div>
      <div className="text-xs opacity-75 mt-1">
        Press 1-5 to switch screens
      </div>
    </div>
  );
}
