import { NextRequest, NextResponse } from 'next/server';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueConfig } from '@/lib/league-config';

interface RouteParams {
  params: Promise<{ leagueSlug: string }>;
}

/**
 * Public endpoint to get league configuration settings.
 * Returns only public-facing settings (no authentication required).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);

  if (!leagueId) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  const config = await getLeagueConfig(leagueId);

  // Return only public-facing settings
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
    smsEnabled: config.smsEnabled,
    homepageTiles: config.homepageTiles,
  });
}
