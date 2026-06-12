import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { getLeagueRole, canAccessAdmin } from "./league-auth";
import { prisma } from "./prisma";

/**
 * Get the league_id for a tournament draft.
 * Shared helper for both API routes and Socket.IO authorization.
 */
export async function getLeagueIdForDraft(draftId: number): Promise<number | null> {
  const draft = await prisma.$queryRaw<{ league_id: number }[]>`
    SELECT league_id FROM tournament_drafts WHERE id = ${draftId}
  `;
  return draft.length ? Number(draft[0].league_id) : null;
}

/**
 * Get the current session and check if the user is an admin for their league.
 * For use in API routes.
 *
 * @returns Object with session, role, and leagueId, or error response
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  const leagueId = session.user.leagueId;
  const role = await getLeagueRole(session.user.uid, leagueId);

  if (!canAccessAdmin(role)) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { session, role, leagueId };
}

/**
 * Check if a user has admin access for a specific league.
 * For use in API routes where you have the leagueId.
 */
export async function requireLeagueAdmin(leagueId: number) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  const role = await getLeagueRole(session.user.uid, leagueId);

  if (!canAccessAdmin(role)) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { session, role, leagueId };
}

/**
 * Verify user has admin access to a tournament draft.
 * Derives league from the draft itself (not from request params).
 * Use this for routes under /api/tournament-drafts/[id]/
 */
export async function requireDraftAdmin(draftId: number) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  // Fetch draft to get its league_id - derive from DB, not from request
  const leagueId = await getLeagueIdForDraft(draftId);

  if (!leagueId) {
    return {
      error: NextResponse.json(
        { error: "Tournament draft not found" },
        { status: 404 }
      ),
    };
  }

  const role = await getLeagueRole(session.user.uid, leagueId);

  if (!canAccessAdmin(role)) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { session, role, leagueId, draftId };
}
