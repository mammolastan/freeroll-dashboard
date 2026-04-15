import { prisma } from '@/lib/prisma';
import { DEFAULT_LEAGUE_CONFIG, LeagueConfig } from '@/types/league-config';

export async function getLeagueConfig(leagueId: number): Promise<LeagueConfig> {
  const league = await prisma.leagues.findUnique({
    where: { id: leagueId },
    select: { league_settings: true },
  });

  if (!league?.league_settings) {
    return { ...DEFAULT_LEAGUE_CONFIG };
  }

  try {
    const stored = JSON.parse(league.league_settings) as Partial<LeagueConfig>;
    // Deep merge gameDefaults so partial stored values don't wipe defaults
    // Note: scoringSystem is not merged with defaults - if stored, use stored; otherwise undefined
    return {
      ...DEFAULT_LEAGUE_CONFIG,
      ...stored,
      gameDefaults: {
        ...DEFAULT_LEAGUE_CONFIG.gameDefaults,
        ...(stored.gameDefaults ?? {}),
      },
      socialLinks: {
        ...DEFAULT_LEAGUE_CONFIG.socialLinks,
        ...(stored.socialLinks ?? {}),
      },
      scoringSystem: stored.scoringSystem,
    };
  } catch {
    console.error(`[getLeagueConfig] Failed to parse league_settings for league ${leagueId}`);
    return { ...DEFAULT_LEAGUE_CONFIG };
  }
}

export async function saveLeagueConfig(
  leagueId: number,
  config: Partial<LeagueConfig>
): Promise<void> {
  // Read current config, merge, write back — never clobber keys we didn't touch
  const current = await getLeagueConfig(leagueId);
  const merged: LeagueConfig = {
    ...current,
    ...config,
    gameDefaults: {
      ...current.gameDefaults,
      ...(config.gameDefaults ?? {}),
    },
    socialLinks: {
      ...current.socialLinks,
      ...(config.socialLinks ?? {}),
    },
    // scoringSystem: if explicitly passed use it, otherwise keep current
    scoringSystem: config.scoringSystem !== undefined ? config.scoringSystem : current.scoringSystem,
  };

  await prisma.leagues.update({
    where: { id: leagueId },
    data: { league_settings: JSON.stringify(merged) },
  });
}
