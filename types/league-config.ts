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

export interface HomepageTilesConfig {
  recentGames: boolean;
  activeGames: boolean;
  // Note: seasonRankings and quarterlyRankings were removed.
  // Point-based rankings now appear automatically based on active competition periods.
  monthlyRankings: boolean;
  statsPlus: boolean;
  players: boolean;
  venues: boolean;
  badges: boolean;
  installApp: boolean;
}

export interface FeaturedModulesConfig {
  otherActiveGames: boolean;
  recentBadges: boolean;
}

export interface TVScreenSettings {
  slideRotationSeconds: number;
  featuredModules: FeaturedModulesConfig;
  // Deprecated - kept for backwards compatibility during migration
  tdChatRotationSeconds?: number;
  featuredRotationSeconds?: number;
}

// Game-level overrides for featured modules (stored in tournament_drafts.featured_settings)
// null = use league default, true/false = explicit override
export interface GameFeaturedSettings {
  otherActiveGames?: boolean | null;
  recentBadges?: boolean | null;
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
    defaultTDMessage: string; // Markdown - shown on TV screen when no TD messages exist
  };

  // Notifications
  pushNotificationsEnabled: boolean;

  // SMS
  smsEnabled: boolean;

  // Homepage & Navigation
  homepageTiles: HomepageTilesConfig;

  // TV Screen
  tvScreenSettings: TVScreenSettings;
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
    defaultTDMessage: '',
  },
  pushNotificationsEnabled: false,
  smsEnabled: false,
  homepageTiles: {
    recentGames: true,
    activeGames: true,
    monthlyRankings: true,
    statsPlus: false,
    players: true,
    venues: true,
    badges: true,
    installApp: true,
  },
  tvScreenSettings: {
    slideRotationSeconds: 15,
    featuredModules: {
      otherActiveGames: true,
      recentBadges: true,
    },
  },
};
