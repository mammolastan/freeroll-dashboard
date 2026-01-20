// app/admin/tournament-entry/hooks/useScreenRouter.ts

'use client';

import { useState, useEffect } from 'react';

export type ScreenNumber = 1 | 2 | 3 | 4 | 5;

export function useScreenRouter(initialScreen: ScreenNumber = 1) {
  const [currentScreen, setCurrentScreen] = useState<ScreenNumber>(initialScreen);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore keyboard shortcuts when user is typing in an input field
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTyping) {
        return;
      }

      // Handle number keys 1-5
      const key = event.key;
      if (['1', '2', '3', '4', '5'].includes(key)) {
        const screenNumber = parseInt(key) as ScreenNumber;
        setCurrentScreen(screenNumber);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return {
    currentScreen,
    setCurrentScreen,
  };
}
