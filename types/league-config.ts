export interface PlacementPoints {
  place: number;
  points: number;
}

export interface ScoringRule {
  placement: number;  // 1-indexed (1 = winner)
  points: number;     // non-negative integer
}

export interface ScoringSystemConfig {
  rules: ScoringRule[];       // ordered ascending by placement
  defaultPoints: number;      // points for any placement beyond the last defined rule
}

export const DEFAULT_SCORING_SYSTEM: ScoringSystemConfig = {
  rules: [
    { placement: 1, points: 10 },
    { placement: 2, points: 7 },
    { placement: 3, points: 6 },
    { placement: 4, points: 5 },
    { placement: 5, points: 4 },
    { placement: 6, points: 3 },
    { placement: 7, points: 2 },
    { placement: 8, points: 1 },
  ],
  defaultPoints: 0,
};

export interface PWAConfig {
  shortName: string;        // Falls back to league.name if empty
  themeColor: string;       // Default: OpenBarLeague cyan
  backgroundColor: string;
  logoUrl: string;          // Falls back to /icons/default-icon-512.png if empty
}

export interface LeagueConfig {
  // Identity
  leagueName: string;
  leagueImageUrl: string | null;
  contactEmail: string | null;
  timezone: string;
  socialLinks: {
    facebook?: string;
    discord?: string;
    website?: string;
  };

  // PWA
  pwa: PWAConfig;

  // Branding
  branding?: {
    themeId: string;
  };

  // Access & Registration
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  allowGuestCheckIn: boolean;

  // Check-In
  allowSelfCheckIn: boolean;
  lateRegistrationWindowMinutes: number;

  // Player Profiles
  allowPlayerProfiles: boolean;
  allowProfilePictures: boolean;
  allowNicknames: boolean;
  showStatsPublicly: boolean;

  // Leaderboard
  leaderboardPublic: boolean;
  gameHistoryPublic: boolean;
  minimumGamesForRanking: number;

  // Badges
  badgesEnabled: boolean;
  enabledBadgeIds: string[];

  // Scoring
  placementPoints: PlacementPoints[];
  participationPoints: number;
  knockoutPoints: number;
  bonusPointsEnabled: boolean;
  scoringSystem?: ScoringSystemConfig;

  // Tiebreakers
  tiebreakerRule: 'most_knockouts' | 'most_wins' | 'most_recent_win';

  // Social / Feed
  tournamentFeedEnabled: boolean;
  chatEnabled: boolean;

  // Per-game defaults (seeded into tournament_drafts on creation)
  gameDefaults: {
    allowChat: boolean;
    allowTvScreen: boolean;
    allowSelfCheckIn: boolean;
    showInActiveGames: boolean;
    blindSchedule: string;
    startPoints: number;
    lateRegistrationWindowMinutes: number;
  };

  // Notifications
  pushNotificationsEnabled: boolean;
}

export const DEFAULT_LEAGUE_CONFIG: LeagueConfig = {
  leagueName: '',
  leagueImageUrl: null,
  contactEmail: null,
  timezone: 'America/New_York',
  socialLinks: {},
  pwa: {
    shortName: '',
    themeColor: '#06b6d4',
    backgroundColor: '#0f172a',
    logoUrl: '',
  },
  branding: {
    themeId: 'default',
  },
  allowSelfRegistration: false,
  requireEmailVerification: false,
  allowGuestCheckIn: false,
  allowSelfCheckIn: true,
  lateRegistrationWindowMinutes: 30,
  allowPlayerProfiles: true,
  allowProfilePictures: true,
  allowNicknames: true,
  showStatsPublicly: true,
  leaderboardPublic: true,
  gameHistoryPublic: true,
  minimumGamesForRanking: 1,
  badgesEnabled: true,
  enabledBadgeIds: [],
  placementPoints: [
    { place: 1, points: 10 },
    { place: 2, points: 7 },
    { place: 3, points: 5 },
    { place: 4, points: 4 },
    { place: 5, points: 3 },
    { place: 6, points: 2 },
    { place: 7, points: 1 },
    { place: 8, points: 1 },
  ],
  participationPoints: 1,
  knockoutPoints: 1,
  bonusPointsEnabled: true,
  tiebreakerRule: 'most_knockouts',
  tournamentFeedEnabled: true,
  chatEnabled: true,
  gameDefaults: {
    allowChat: true,
    allowTvScreen: true,
    allowSelfCheckIn: true,
    showInActiveGames: true,
    blindSchedule: 'standard',
    startPoints: 1,
    lateRegistrationWindowMinutes: 100,
  },
  pushNotificationsEnabled: false,
};
