// lib/themes.ts

export interface ThemePreset {
  id: string;
  name: string;
  colors: {
    primary: string;
    primaryHover: string;
    surface: string;
    surfaceHover: string;
    // Ranking card colors (light backgrounds for dark text)
    rankingBadge: string;
    qualifiedBadge: string; // Background for qualified players' ranking badge
    stat1: string;
    stat2: string;
    stat3: string;
    stat4: string;
    stat5: string;
  };
}

// Each theme has stat colors derived from its primary hue
// Stats are pastel/light colors suitable as backgrounds for dark text
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Classic Cyan',
    colors: {
      primary: '#06b6d4',
      primaryHover: '#0891b2',
      surface: '#1e293b',
      surfaceHover: '#334155',
      rankingBadge: '#a5f3fc',
      qualifiedBadge: '#22d3ee', // cyan-400
      stat1: '#a5f3fc', // cyan-200
      stat2: '#99f6e4', // teal-200
      stat3: '#6ee7b7', // emerald-300
      stat4: '#5eead4', // teal-300
      stat5: '#67e8f9', // cyan-300
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
      rankingBadge: '#bfdbfe',
      qualifiedBadge: '#60a5fa', // blue-400
      stat1: '#bfdbfe', // blue-200
      stat2: '#a5b4fc', // indigo-300
      stat3: '#c4b5fd', // violet-300
      stat4: '#93c5fd', // blue-300
      stat5: '#7dd3fc', // sky-300
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
      rankingBadge: '#fecaca',
      qualifiedBadge: '#f87171', // red-400
      stat1: '#fecaca', // red-200
      stat2: '#fed7aa', // orange-200
      stat3: '#fde68a', // amber-200
      stat4: '#fca5a5', // red-300
      stat5: '#fdba74', // orange-300
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
      rankingBadge: '#a7f3d0',
      qualifiedBadge: '#34d399', // emerald-400
      stat1: '#a7f3d0', // emerald-200
      stat2: '#99f6e4', // teal-200
      stat3: '#6ee7b7', // emerald-300
      stat4: '#86efac', // green-300
      stat5: '#5eead4', // teal-300
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
      rankingBadge: '#fde68a',
      qualifiedBadge: '#fbbf24', // amber-400
      stat1: '#fde68a', // amber-200
      stat2: '#fef08a', // yellow-200
      stat3: '#fed7aa', // orange-200
      stat4: '#fcd34d', // amber-300
      stat5: '#fdba74', // orange-300
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
      rankingBadge: '#ddd6fe',
      qualifiedBadge: '#a78bfa', // violet-400
      stat1: '#ddd6fe', // violet-200
      stat2: '#c4b5fd', // violet-300
      stat3: '#e9d5ff', // purple-200
      stat4: '#a5b4fc', // indigo-300
      stat5: '#d8b4fe', // purple-300
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
      rankingBadge: '#fecdd3',
      qualifiedBadge: '#fb7185', // rose-400
      stat1: '#fecdd3', // rose-200
      stat2: '#fbcfe8', // pink-200
      stat3: '#fda4af', // rose-300
      stat4: '#f9a8d4', // pink-300
      stat5: '#fecaca', // red-200
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
      rankingBadge: '#99f6e4',
      qualifiedBadge: '#2dd4bf', // teal-400
      stat1: '#99f6e4', // teal-200
      stat2: '#a7f3d0', // emerald-200
      stat3: '#5eead4', // teal-300
      stat4: '#6ee7b7', // emerald-300
      stat5: '#a5f3fc', // cyan-200
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
      rankingBadge: '#fed7aa',
      qualifiedBadge: '#fb923c', // orange-400
      stat1: '#fed7aa', // orange-200
      stat2: '#fde68a', // amber-200
      stat3: '#fdba74', // orange-300
      stat4: '#fcd34d', // amber-300
      stat5: '#fecaca', // red-200
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
      rankingBadge: '#c7d2fe',
      qualifiedBadge: '#818cf8', // indigo-400
      stat1: '#c7d2fe', // indigo-200
      stat2: '#a5b4fc', // indigo-300
      stat3: '#ddd6fe', // violet-200
      stat4: '#bfdbfe', // blue-200
      stat5: '#c4b5fd', // violet-300
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
      rankingBadge: '#cbd5e1',
      qualifiedBadge: '#94a3b8', // slate-400
      stat1: '#cbd5e1', // slate-300
      stat2: '#d1d5db', // gray-300
      stat3: '#e2e8f0', // slate-200
      stat4: '#e5e7eb', // gray-200
      stat5: '#f1f5f9', // slate-100
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
      rankingBadge: '#d9f99d',
      qualifiedBadge: '#a3e635', // lime-400
      stat1: '#d9f99d', // lime-200
      stat2: '#bef264', // lime-300
      stat3: '#a3e635', // lime-400
      stat4: '#bbf7d0', // green-200
      stat5: '#fef08a', // yellow-200
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
    '--theme-ranking-badge': theme.colors.rankingBadge,
    '--theme-qualified-badge': theme.colors.qualifiedBadge,
    '--theme-stat1': theme.colors.stat1,
    '--theme-stat2': theme.colors.stat2,
    '--theme-stat3': theme.colors.stat3,
    '--theme-stat4': theme.colors.stat4,
    '--theme-stat5': theme.colors.stat5,
  };
}
