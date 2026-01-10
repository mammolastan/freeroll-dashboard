// types/components.ts
// Shared component prop types and UI-related types

import React from 'react';

/**
 * Player interface for tournament entry components
 * This is used across PlayerRow, FullAdminScreen, etc.
 */
export interface TournamentPlayer {
  id: number;
  player_name: string;
  player_uid: string | null;
  player_nickname?: string | null;
  is_new_player: boolean;
  hitman_name: string | null;
  ko_position: number | null;
  placement: number | null;
  added_by?: 'admin' | 'self_checkin';
  checked_in_at?: string | Date | null;
}

/**
 * Badge display data
 */
export interface BadgeDisplay {
  badge_id: string;
  short_description: string;
  long_description?: string;
  icon: string | null;
  rarity: number;
  category: string;
  tier?: string | null;
  earned_at?: Date | string;
  quarter?: string | null;
  year?: number | null;
}

/**
 * Player profile data for display
 */
export interface PlayerProfile {
  uid: string;
  name: string;
  nickname: string | null;
  email: string | null;
  photo_url: string | null;
  created_at: Date | string;
  badges?: BadgeDisplay[];
  stats?: {
    total_games: number;
    total_points: number;
    total_knockouts: number;
    avg_placement: number | null;
    best_placement: number | null;
  };
}

/**
 * Tournament display data
 */
export interface TournamentDisplay {
  id: number;
  tournament_date: Date | string;
  tournament_time?: string | null;
  director_name: string;
  venue: string;
  start_points: number;
  status: 'in_progress' | 'finalized' | 'integrated';
  player_count?: number;
  game_uid?: string | null;
}

/**
 * Ranking entry for leaderboard display
 */
export interface RankingEntry {
  rank: number;
  player_uid: string;
  player_name: string;
  player_nickname: string | null;
  photo_url: string | null;
  score: number;
  games_played: number;
  badges?: BadgeDisplay[];
}

/**
 * Modal props interface
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Badge modal props
 */
export interface BadgeModalProps {
  badge: BadgeDisplay | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Player avatar modal props
 */
export interface PlayerAvatarModalProps {
  player: {
    uid: string;
    name: string;
    nickname: string | null;
    photo_url: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Timer display props
 */
export interface TimerProps {
  tournamentId: number;
  initialLevel?: number;
  initialSeconds?: number;
  isRunning?: boolean;
  isPaused?: boolean;
  blindSchedule?: string;
  onTimerUpdate?: (state: TimerState) => void;
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
 * Blind level structure
 */
export interface BlindLevel {
  level: number;
  small_blind: number;
  big_blind: number;
  ante?: number;
  duration_minutes: number;
  break_after?: boolean;
  break_duration_minutes?: number;
}

/**
 * Player row props (for PlayerRow component)
 */
export interface PlayerRowProps {
  player: TournamentPlayer;
  isIntegrated: boolean;
  hitmanSearchValue: string;
  hitmanDropdownVisible: boolean;
  hitmanHighlightedIndex: number;
  hitmanCandidates: TournamentPlayer[];
  onHitmanSearchChange: (value: string) => void;
  onHitmanFocus: () => void;
  onHitmanBlur: () => void;
  onHitmanKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onHitmanSelect: (hitmanName: string) => void;
  onCrosshairClick: () => void;
  onKOPositionChange: (koPosition: number | null) => void;
  onKOInputFocus: () => void;
  onKOInputBlur: () => void;
  onRemove: () => void;
  renderPlayerIndicator: (player: TournamentPlayer) => React.ReactNode;
}

/**
 * Check-in modal props
 */
export interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: number;
  checkInToken: string | null;
  onPlayerCheckedIn?: (player: TournamentPlayer) => void;
}

/**
 * Stat card data
 */
export interface StatCardData {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  sublabel?: string;
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

/**
 * Table column definition
 */
export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Sort state
 */
export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Filter state
 */
export interface FilterState {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Search state
 */
export interface SearchState {
  query: string;
  field?: string;
}

/**
 * Loading state
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Toast notification
 */
export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

/**
 * Form field error
 */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Form state
 */
export interface FormState<T = Record<string, unknown>> {
  values: T;
  errors: FieldError[];
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

/**
 * Select option
 */
export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Player search result for autocomplete
 */
export interface PlayerSearchOption {
  uid: string;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  label?: string; // Computed: name + nickname
}

/**
 * Venue option for select
 */
export interface VenueOption {
  value: string;
  label: string;
  games_hosted?: number;
}

/**
 * Quarter option for filters
 */
export interface QuarterOption {
  value: string; // Format: "Q1-2024"
  label: string; // Format: "Q1 2024"
  year: number;
  quarter: number;
}

/**
 * Date range
 */
export interface DateRange {
  start: Date | string;
  end: Date | string;
}

/**
 * Game view data for display
 */
export interface GameViewData {
  tournament: TournamentDisplay;
  players: TournamentPlayer[];
  timer: TimerState;
  stats: {
    total_players: number;
    active_players: number;
    eliminated_players: number;
    checked_in_players: number;
  };
}

/**
 * Color theme type
 */
export type ColorTheme = 'light' | 'dark' | 'system';

/**
 * Rarity tier
 */
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Badge category
 */
export type BadgeCategory =
  | 'achievement'
  | 'milestone'
  | 'special'
  | 'seasonal'
  | 'competitive'
  | 'participation';
