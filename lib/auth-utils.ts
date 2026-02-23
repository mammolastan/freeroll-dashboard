import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

/**
 * Get the current session and check if the user is an admin.
 * For use in API routes.
 *
 * @returns Object with session and isAdmin flag, or error response
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

  if (!session.user.isAdmin) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { session };
}

/**
 * Check if a session user is an admin.
 * For use in server components or middleware.
 */
export function isAdmin(session: { user?: { isAdmin?: boolean } } | null): boolean {
  return session?.user?.isAdmin === true;
}
