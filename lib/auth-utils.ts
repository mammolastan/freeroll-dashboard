import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { getLeagueRole, canAccessAdmin } from "./league-auth";

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
