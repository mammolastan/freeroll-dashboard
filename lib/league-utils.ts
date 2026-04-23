// lib/league-utils.ts

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

// In-memory cache: slug → league_id
// Resets on server restart — acceptable for this use case
const slugCache = new Map<string, number>();

export async function getLeagueIdBySlug(slug: string): Promise<number | null> {
  if (slugCache.has(slug)) return slugCache.get(slug)!;
  const league = await prisma.leagues.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (league) {
    slugCache.set(slug, league.id);
    return league.id;
  }
  return null;
}

// Main function — use this in all API routes
// Accepts both NextRequest and Request for flexibility
// NOTE: Query params are checked FIRST to allow route caching.
// Calling getServerSession() reads cookies, which forces the route to be dynamic.
export async function getLeagueIdFromRequest(
  request: NextRequest | Request
): Promise<number> {
  // Handle both NextRequest and plain Request
  const url = 'nextUrl' in request ? request.nextUrl : new URL(request.url);
  const params = url.searchParams;

  // 1. ?league=slug (check first to preserve route caching)
  const slugParam = params.get('league');
  if (slugParam) {
    const id = await getLeagueIdBySlug(slugParam);
    if (id) return id;
  }

  // 2. ?league_id=N
  const idParam = params.get('league_id');
  if (idParam) {
    const parsed = parseInt(idParam);
    if (!isNaN(parsed)) return parsed;
  }

  // 3. Authenticated session (only check if no query param provided)
  // NOTE: This call reads cookies and makes the route dynamic
  const session = await getServerSession(authOptions);
  if (session?.user?.leagueId) return session.user.leagueId;

  // 4. DEFAULT_LEAGUE_SLUG env var
  const defaultSlug = process.env.DEFAULT_LEAGUE_SLUG;
  if (defaultSlug) {
    const id = await getLeagueIdBySlug(defaultSlug);
    if (id) return id;
  }

  // 5. Hard fallback
  return 1;
}
