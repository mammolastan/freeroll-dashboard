import { NextRequest, NextResponse } from 'next/server';
import { getLeagueIdFromRequest } from '@/lib/league-utils';
import { getLeagueConfig } from '@/lib/league-config';

/**
 * Legacy/query-param entry for public league config.
 * Prefer `/api/[leagueSlug]/config` when the slug is known; this route resolves
 * league via `getLeagueIdFromRequest` (?league=, ?league_id=, session, defaults).
 */
export async function GET(req: NextRequest) {
  const leagueId = await getLeagueIdFromRequest(req);
  const config = await getLeagueConfig(leagueId);

  return NextResponse.json({
    leagueName: config.leagueName,
    leagueImageUrl: config.leagueImageUrl,
    timezone: config.timezone,
    badgesEnabled: config.badgesEnabled,
    leaderboardPublic: config.leaderboardPublic,
    gameHistoryPublic: config.gameHistoryPublic,
    showStatsPublicly: config.showStatsPublicly,
    allowPlayerProfiles: config.allowPlayerProfiles,
    allowProfilePictures: config.allowProfilePictures,
    allowNicknames: config.allowNicknames,
    chatEnabled: config.chatEnabled,
    tournamentFeedEnabled: config.tournamentFeedEnabled,
  });
}
