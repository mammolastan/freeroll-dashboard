// lib/themes.ts

export interface ThemePreset {
  id: string;
  name: string;
  colors: {
    primary: string;
    primaryHover: string;
    surface: string;
    surfaceHover: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Classic Cyan',
    colors: {
      primary: '#06b6d4',
      primaryHover: '#0891b2',
      surface: '#1e293b',
      surfaceHover: '#334155',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      surface: '#1e3a5f',
      surfaceHover: '#2d4a6f',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson Fire',
    colors: {
      primary: '#ef4444',
      primaryHover: '#dc2626',
      surface: '#450a0a',
      surfaceHover: '#5c1a1a',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    colors: {
      primary: '#10b981',
      primaryHover: '#059669',
      surface: '#064e3b',
      surfaceHover: '#0d5e4a',
    },
  },
  {
    id: 'amber',
    name: 'Golden Amber',
    colors: {
      primary: '#f59e0b',
      primaryHover: '#d97706',
      surface: '#451a03',
      surfaceHover: '#5c2a13',
    },
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    colors: {
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      surface: '#2e1065',
      surfaceHover: '#3e2075',
    },
  },
  {
    id: 'rose',
    name: 'Rose Pink',
    colors: {
      primary: '#f43f5e',
      primaryHover: '#e11d48',
      surface: '#4c0519',
      surfaceHover: '#5c1529',
    },
  },
  {
    id: 'teal',
    name: 'Teal Depths',
    colors: {
      primary: '#14b8a6',
      primaryHover: '#0d9488',
      surface: '#134e4a',
      surfaceHover: '#235e5a',
    },
  },
  {
    id: 'orange',
    name: 'Sunset Orange',
    colors: {
      primary: '#f97316',
      primaryHover: '#ea580c',
      surface: '#431407',
      surfaceHover: '#532417',
    },
  },
  {
    id: 'indigo',
    name: 'Deep Indigo',
    colors: {
      primary: '#6366f1',
      primaryHover: '#4f46e5',
      surface: '#1e1b4b',
      surfaceHover: '#2e2b5b',
    },
  },
  {
    id: 'slate',
    name: 'Stealth Slate',
    colors: {
      primary: '#64748b',
      primaryHover: '#475569',
      surface: '#1e293b',
      surfaceHover: '#334155',
    },
  },
  {
    id: 'lime',
    name: 'Electric Lime',
    colors: {
      primary: '#84cc16',
      primaryHover: '#65a30d',
      surface: '#1a2e05',
      surfaceHover: '#2a3e15',
    },
  },
];

export function getThemeById(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}

export function getThemeCSSVariables(theme: ThemePreset): Record<string, string> {
  return {
    '--theme-primary': theme.colors.primary,
    '--theme-primary-hover': theme.colors.primaryHover,
    '--theme-surface': theme.colors.surface,
    '--theme-surface-hover': theme.colors.surfaceHover,
  };
}
