'use client';

import { ReactNode, useEffect } from 'react';
import { getThemeById, getThemeCSSVariables } from '@/lib/themes';

interface ThemeProviderProps {
  themeId: string;
  children: ReactNode;
}

export function ThemeProvider({ themeId, children }: ThemeProviderProps) {
  const theme = getThemeById(themeId);
  const cssVars = getThemeCSSVariables(theme);

  // Set CSS variables on :root so they're available globally (including Navbar)
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Cleanup: reset to defaults when unmounting or theme changes
    return () => {
      Object.keys(cssVars).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, [cssVars]);

  return <>{children}</>;
}
