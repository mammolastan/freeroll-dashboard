// lib/LeagueContext.tsx
'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';

interface LeagueContextValue {
  leagueSlug: string | null;
  timezone: string;
}

const DEFAULT_TIMEZONE = 'America/New_York';

const LeagueContext = createContext<LeagueContextValue>({
  leagueSlug: null,
  timezone: DEFAULT_TIMEZONE,
});

export function LeagueProvider({
  slug,
  timezone = DEFAULT_TIMEZONE,
  children,
}: {
  slug: string;
  timezone?: string;
  children: React.ReactNode;
}) {
  return (
    <LeagueContext.Provider value={{ leagueSlug: slug, timezone }}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}

/** Convenience hook for components that only need the timezone */
export function useLeagueTimezone(): string {
  return useContext(LeagueContext).timezone;
}

/**
 * Hook to get the league URL prefix for building league-aware links.
 * Works both inside and outside LeagueProvider by also checking pathname.
 *
 * All league routes are under /l/[leagueSlug]/...
 *
 * Usage:
 *   const prefix = useLeaguePrefix();
 *   <Link href={`${prefix}/games/${gameId}`}>View Game</Link>
 */
export function useLeaguePrefix(): string {
  const { leagueSlug: contextSlug } = useLeague();
  const pathname = usePathname();

  // Try context first - always use /l/ prefix
  if (contextSlug) return `/l/${contextSlug}`;

  // Fall back to extracting from pathname
  if (pathname) {
    const segments = pathname.split('/');
    // Check for /l/[leagueSlug] pattern
    if (segments[1] === 'l' && segments[2]) {
      return `/l/${segments[2]}`;
    }
  }

  return '';
}
