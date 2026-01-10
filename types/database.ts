// types/database.ts
// Database and Prisma-related types

import { Prisma } from '@prisma/client';

/**
 * Re-export Prisma generated types for convenience
 * Import these instead of importing from @prisma/client directly
 */
export type {
  Player,
  Badge,
  PlayerBadge,
  PokerTournament,
  TournamentDraft,
  TournamentDraftPlayer,
  ProcessedFile,
  PasswordReset,
  bonus_points as BonusPoints,
} from '@prisma/client';

/**
 * Re-export enums
 */
export {
  Status,
  TournamentDraftStatus,
  tournament_draft_players_added_by as PlayerAddedBy
} from '@prisma/client';

/**
 * Player with related data
 */
export type PlayerWithBadges = Prisma.PlayerGetPayload<{
  include: { PlayerBadge: { include: { badge: true } } };
}>;

export type PlayerWithAllRelations = Prisma.PlayerGetPayload<{
  include: {
    PlayerBadge: { include: { badge: true } };
    bonus_points: true;
  };
}>;

/**
 * Tournament draft with players
 */
export type TournamentDraftWithPlayers = Prisma.TournamentDraftGetPayload<{
  include: { players: true };
}>;

/**
 * Tournament draft player with tournament info
 */
export type TournamentDraftPlayerWithTournament = Prisma.TournamentDraftPlayerGetPayload<{
  include: { tournament_draft: true };
}>;

/**
 * Player badge with full badge and player info
 */
export type PlayerBadgeWithDetails = Prisma.PlayerBadgeGetPayload<{
  include: {
    player: true;
    badge: true;
  };
}>;

/**
 * Badge with all players who earned it
 */
export type BadgeWithPlayers = Prisma.BadgeGetPayload<{
  include: {
    players: {
      include: {
        player: true;
      };
    };
  };
}>;

/**
 * Select types for partial queries
 */
export type PlayerBasicInfo = Pick<
  Prisma.PlayerGetPayload<object>,
  'uid' | 'name' | 'nickname' | 'email' | 'photo_url'
>;

export type PlayerPublicInfo = Pick<
  Prisma.PlayerGetPayload<object>,
  'uid' | 'name' | 'nickname' | 'photo_url'
>;

export type TournamentBasicInfo = Pick<
  Prisma.TournamentDraftGetPayload<object>,
  'id' | 'tournament_date' | 'tournament_time' | 'venue' | 'status'
>;

/**
 * Create input types for API requests
 */
export type PlayerCreateInput = Prisma.PlayerCreateInput;
export type PlayerUpdateInput = Prisma.PlayerUpdateInput;
export type TournamentDraftCreateInput = Prisma.TournamentDraftCreateInput;
export type TournamentDraftUpdateInput = Prisma.TournamentDraftUpdateInput;
export type TournamentDraftPlayerCreateInput = Prisma.TournamentDraftPlayerCreateInput;
export type TournamentDraftPlayerUpdateInput = Prisma.TournamentDraftPlayerUpdateInput;
export type BadgeCreateInput = Prisma.BadgeCreateInput;
export type PlayerBadgeCreateInput = Prisma.PlayerBadgeCreateInput;

/**
 * Where clause types for queries
 */
export type PlayerWhereInput = Prisma.PlayerWhereInput;
export type TournamentDraftWhereInput = Prisma.TournamentDraftWhereInput;
export type TournamentDraftPlayerWhereInput = Prisma.TournamentDraftPlayerWhereInput;
export type BadgeWhereInput = Prisma.BadgeWhereInput;
export type PlayerBadgeWhereInput = Prisma.PlayerBadgeWhereInput;

/**
 * OrderBy types for sorting
 */
export type PlayerOrderByInput = Prisma.PlayerOrderByWithRelationInput;
export type TournamentDraftOrderByInput = Prisma.TournamentDraftOrderByWithRelationInput;
export type BadgeOrderByInput = Prisma.BadgeOrderByWithRelationInput;

/**
 * Database query options
 */
export interface QueryOptions {
  skip?: number;
  take?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

/**
 * Database transaction type
 * Use this for Prisma transactions
 */
export type PrismaTransaction = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Type for raw query results
 * Use instead of `any` for raw SQL queries
 */
export type RawQueryResult = Record<string, unknown>;

/**
 * Tournament statistics aggregate
 */
export interface TournamentStats {
  total_tournaments: number;
  total_players: number;
  unique_players: number;
  avg_players_per_tournament: number;
  total_knockouts: number;
}

/**
 * Player performance metrics
 */
export interface PlayerPerformance {
  player_uid: string;
  player_name: string;
  player_nickname: string | null;
  games_played: number;
  total_points: number;
  total_knockouts: number;
  avg_placement: number | null;
  best_placement: number | null;
  worst_placement: number | null;
  win_rate: number | null;
  top_3_rate: number | null;
}

/**
 * Venue statistics
 */
export interface VenueStatistics {
  venue_name: string;
  total_games: number;
  total_unique_players: number;
  avg_players_per_game: number | null;
  most_recent_game: Date | null;
  most_frequent_winner: {
    player_uid: string;
    player_name: string;
    wins: number;
  } | null;
}

/**
 * Badge earning statistics
 */
export interface BadgeEarningStats {
  badge_id: string;
  badge_name: string;
  times_earned: number;
  unique_players: number;
  most_recent_earning: Date | null;
  rarity_score: number;
}

/**
 * Quarterly performance data
 */
export interface QuarterlyPerformance {
  quarter: string;
  year: number;
  player_uid: string;
  games_played: number;
  total_points: number;
  rank: number | null;
  badges_earned: number;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  player_uid: string;
  player_name: string;
  player_nickname: string | null;
  score: number;
  games_played: number;
  photo_url: string | null;
}

/**
 * Game summary
 */
export interface GameSummary {
  game_uid: string;
  game_date: Date;
  venue: string;
  total_players: number;
  winner: {
    uid: string;
    name: string;
    nickname: string | null;
  } | null;
  total_knockouts: number;
}

/**
 * Player activity summary
 */
export interface PlayerActivity {
  player_uid: string;
  last_game_date: Date | null;
  games_last_30_days: number;
  games_last_90_days: number;
  games_this_quarter: number;
  is_active: boolean;
}
