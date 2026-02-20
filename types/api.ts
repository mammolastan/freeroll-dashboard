// types/api.ts
// API response and request types

import { Prisma } from '@prisma/client';

/**
 * Standard API response wrapper
 * Use this for all API endpoints to maintain consistency
 */
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore?: boolean;
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Next.js API route context with typed params
 * Use this for route params that need to be awaited
 */
export interface RouteContext<T extends Record<string, string> = Record<string, string>> {
  params: Promise<T> | T;
}

/**
 * Common route param types
 */
export interface IdRouteParams {
  id: string;
}

export interface UidRouteParams {
  uid: string;
}

export interface TokenRouteParams {
  token: string;
}

export interface VenueRouteParams {
  venue: string;
}

export interface PlayerIdRouteParams {
  playerid: string;
}

/**
 * Search query parameters
 */
export interface SearchParams {
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Tournament draft player creation request
 */
export interface CreatePlayerRequest {
  player_name: string;
  player_uid?: string | null;
  player_nickname?: string | null;
  is_new_player?: boolean;
  hitman_name?: string | null;
  ko_position?: number | null;
  placement?: number | null;
  added_by?: 'admin' | 'self_checkin';
}

/**
 * Tournament draft player update request
 */
export interface UpdatePlayerRequest {
  player_name?: string;
  player_uid?: string | null;
  player_nickname?: string | null;
  is_new_player?: boolean;
  hitman_name?: string | null;
  ko_position?: number | null;
  placement?: number | null;
}

/**
 * Batch player update request
 */
export interface BatchPlayerUpdate {
  id: number;
  hitman_name?: string | null;
  ko_position?: number | null;
  placement?: number | null;
}

/**
 * Tournament creation request
 */
export interface CreateTournamentRequest {
  tournament_date: string | Date;
  tournament_time?: string | null;
  director_name: string;
  venue: string;
  start_points?: number;
  blind_schedule?: string;
}

/**
 * Tournament update request
 */
export interface UpdateTournamentRequest {
  tournament_date?: string | Date;
  tournament_time?: string | null;
  director_name?: string;
  venue?: string;
  start_points?: number;
  status?: 'in_progress' | 'finalized' | 'integrated';
  blind_schedule?: string;
  custom_blind_levels?: string | null;
}

/**
 * Badge assignment request
 */
export interface AssignBadgeRequest {
  player_uid: string;
  badge_id: string;
  earned_at?: string | Date;
  quarter?: string;
  year?: number;
  game_id?: string;
  description?: string;
  expiration?: string | Date | null;
}

/**
 * Player search result
 */
export interface PlayerSearchResult {
  uid: string;
  name: string;
  nickname: string | null;
  email: string | null;
  photo_url: string | null;
  total_games?: number;
  total_knockouts?: number;
  avg_placement?: number;
}

/**
 * Venue stats
 */
export interface VenueStats {
  venue: string;
  total_games: number;
  total_players: number;
  unique_players: number;
  avg_players_per_game: number;
  most_frequent_players?: Array<{
    uid: string;
    name: string;
    nickname: string | null;
    games_played: number;
  }>;
}

/**
 * Player stats
 */
export interface PlayerStats {
  uid: string;
  name: string;
  nickname: string | null;
  total_games: number;
  total_knockouts: number;
  total_points: number;
  avg_placement: number;
  best_placement: number;
  worst_placement: number;
  venues_played: string[];
  seasons_active: string[];
}

/**
 * Quarterly rankings
 */
export interface QuarterlyRanking {
  rank: number;
  player_uid: string;
  player_name: string;
  player_nickname: string | null;
  total_points: number;
  games_played: number;
  avg_points_per_game: number;
  total_knockouts: number;
  best_placement: number;
  badges?: Array<{
    badge_id: string;
    short_description: string;
    icon: string | null;
    rarity: number;
  }>;
}

/**
 * Timer state
 */
export interface TimerState {
  current_level: number;
  remaining_seconds: number;
  is_running: boolean;
  is_paused: boolean;
  last_updated: Date | string;
}

/**
 * Error type for catch blocks
 * Use this instead of `any` in error handling
 */
export type CatchError = unknown;

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: CatchError): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if error is a Prisma error
 */
export function isPrismaError(error: CatchError): error is Prisma.PrismaClientKnownRequestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'meta' in error
  );
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: CatchError): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

/**
 * Type for JSON values from database
 * Use instead of `any` for JSON columns
 */
export type JsonValue = Prisma.JsonValue;

/**
 * Type for dynamic objects with string keys
 * Use instead of `any` when you need a flexible object
 */
export type DynamicObject = Record<string, unknown>;

/**
 * Type for query results that might be null
 */
export type Nullable<T> = T | null;
