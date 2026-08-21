import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDraftAdmin } from "@/lib/auth-utils";
import { getLeagueConfig } from "@/lib/league-config";
import { GameFeaturedSettings } from "@/types/league-config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Fetch current featured settings for a game, merged with league defaults.
 * Returns the effective settings (game overrides take precedence over league defaults).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const draftId = parseInt(id, 10);

    if (isNaN(draftId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Get the tournament draft
    const draft = await prisma.tournamentDraft.findUnique({
      where: { id: draftId },
      select: {
        id: true,
        league_id: true,
        featured_settings: true,
      },
    });

    if (!draft) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Get league config for defaults
    const leagueConfig = await getLeagueConfig(draft.league_id);
    const leagueDefaults = leagueConfig.tvScreenSettings?.featuredModules ?? {
      otherActiveGames: true,
    };

    // Parse game-level overrides
    let gameOverrides: GameFeaturedSettings = {};
    if (draft.featured_settings) {
      try {
        gameOverrides = JSON.parse(draft.featured_settings);
      } catch {
        // Invalid JSON, use empty overrides
      }
    }

    // Compute effective settings (game override > league default)
    const effectiveSettings = {
      otherActiveGames:
        gameOverrides.otherActiveGames !== null &&
        gameOverrides.otherActiveGames !== undefined
          ? gameOverrides.otherActiveGames
          : leagueDefaults.otherActiveGames,
    };

    return NextResponse.json({
      leagueDefaults,
      gameOverrides,
      effectiveSettings,
    });
  } catch (error) {
    console.error("Error fetching featured settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update game-level featured settings overrides.
 * Requires admin access to the tournament.
 *
 * Body:
 *   - otherActiveGames: boolean | null (null = use league default)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const draftId = parseInt(id, 10);

    if (isNaN(draftId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Verify user is admin for this draft's league
    const auth = await requireDraftAdmin(draftId);
    if (auth.error) return auth.error;

    const body = await req.json();

    // Get current settings
    const draft = await prisma.tournamentDraft.findUnique({
      where: { id: draftId },
      select: {
        id: true,
        league_id: true,
        featured_settings: true,
      },
    });

    if (!draft) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Parse current overrides
    let currentOverrides: GameFeaturedSettings = {};
    if (draft.featured_settings) {
      try {
        currentOverrides = JSON.parse(draft.featured_settings);
      } catch {
        // Invalid JSON, start fresh
      }
    }

    // Merge new values
    const newOverrides: GameFeaturedSettings = {
      ...currentOverrides,
    };

    // Handle otherActiveGames
    if ("otherActiveGames" in body) {
      if (body.otherActiveGames === null) {
        // Reset to league default
        delete newOverrides.otherActiveGames;
      } else if (typeof body.otherActiveGames === "boolean") {
        newOverrides.otherActiveGames = body.otherActiveGames;
      }
    }

    // Update the database
    const settingsJson =
      Object.keys(newOverrides).length > 0
        ? JSON.stringify(newOverrides)
        : null;

    await prisma.tournamentDraft.update({
      where: { id: draftId },
      data: {
        featured_settings: settingsJson,
      },
    });

    // Get league config for response
    const leagueConfig = await getLeagueConfig(draft.league_id);
    const leagueDefaults = leagueConfig.tvScreenSettings?.featuredModules ?? {
      otherActiveGames: true,
    };

    // Compute effective settings
    const effectiveSettings = {
      otherActiveGames:
        newOverrides.otherActiveGames !== null &&
        newOverrides.otherActiveGames !== undefined
          ? newOverrides.otherActiveGames
          : leagueDefaults.otherActiveGames,
    };

    return NextResponse.json({
      leagueDefaults,
      gameOverrides: newOverrides,
      effectiveSettings,
    });
  } catch (error) {
    console.error("Error updating featured settings:", error);
    return NextResponse.json(
      { error: "Failed to update featured settings" },
      { status: 500 }
    );
  }
}
