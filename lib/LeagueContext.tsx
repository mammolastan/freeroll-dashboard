// lib/LeagueContext.tsx
'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';

interface LeagueContextValue {
  leagueSlug: string | null;
}

const LeagueContext = createContext<LeagueContextValue>({ leagueSlug: null });

export function LeagueProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <LeagueContext.Provider value={{ leagueSlug: slug }}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}

// Reserved paths that are NOT league slugs
const RESERVED_PATHS = [
  'admin', 'login', 'register', 'profile', 'api', 'tvscreen',
  '_next', 'rankings', 'venues', 'players', 'games', 'check-in',
  'badges', 'unauthorized', 'activeTournament', 'gameview', 'knockouts'
];

/**
 * Hook to get the league URL prefix for building league-aware links.
 * Works both inside and outside LeagueProvider by also checking pathname.
 *
 * Usage:
 *   const prefix = useLeaguePrefix();
 *   <Link href={`${prefix}/games/${gameId}`}>View Game</Link>
 */
export function useLeaguePrefix(): string {
  const { leagueSlug: contextSlug } = useLeague();
  const pathname = usePathname();

  // Try context first
  if (contextSlug) return `/${contextSlug}`;

  // Fall back to extracting from pathname
  if (pathname) {
    const firstSegment = pathname.split('/')[1];
    if (firstSegment && !RESERVED_PATHS.includes(firstSegment)) {
      return `/${firstSegment}`;
    }
  }

  return '';
}
