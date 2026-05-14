'use client';

import { ReactNode } from 'react';
import { getThemeById, getThemeCSSVariables } from '@/lib/themes';

interface ThemeProviderProps {
  themeId: string;
  children: ReactNode;
}

export function ThemeProvider({ themeId, children }: ThemeProviderProps) {
  const theme = getThemeById(themeId);
  const cssVars = getThemeCSSVariables(theme);

  return (
    <div style={cssVars as React.CSSProperties}>
      {children}
    </div>
  );
}
