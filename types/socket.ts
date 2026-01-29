// types/socket.ts
// Socket.IO event types and real-time communication

import { TournamentDraftStatus } from '@prisma/client';

/**
 * Player data for real-time updates
 * This represents a player in the context of an active tournament
 */
export interface RealtimePlayer {
  id: number;
  player_name: string;
  player_uid: string | null;
  player_nickname: string | null;
  is_new_player: boolean;
  hitman_name: string | null;
  ko_position: number | null;
  placement: number | null;
  checked_in_at: Date | string | null;
  added_by?: 'admin' | 'self_checkin';
}

/**
 * Tournament data for real-time updates
 */
export interface RealtimeTournament {
  id: number;
  tournament_date: Date | string;
  tournament_time: string | null;
  director_name: string;
  venue: string;
  start_points: number;
  status: TournamentDraftStatus;
  game_uid: string | null;
  blind_schedule: string | null;
  check_in_token: string | null;
}

/**
 * Timer state for real-time updates
 */
export interface RealtimeTimerState {
  current_level: number;
  remaining_seconds: number;
  is_running: boolean;
  is_paused: boolean;
  last_updated: Date | string;
}

/**
 * Complete tournament state for game view
 */
export interface TournamentGameState {
  tournament: RealtimeTournament;
  players: RealtimePlayer[];
  timer: RealtimeTimerState;
  stats: {
    total_players: number;
    active_players: number;
    eliminated_players: number;
    checked_in_players: number;
  };
}

/**
 * Player update event payload
 */
export interface PlayerUpdatePayload {
  tournament_id: number;
  player: RealtimePlayer;
  action: 'added' | 'updated' | 'removed' | 'checked_in';
}

/**
 * Tournament update event payload
 */
export interface TournamentUpdatePayload {
  tournament_id: number;
  tournament: Partial<RealtimeTournament>;
  action: 'updated' | 'status_changed' | 'finalized';
}

/**
 * Timer update event payload
 */
export interface TimerUpdatePayload {
  tournament_id: number;
  timer: RealtimeTimerState;
  action: 'started' | 'paused' | 'resumed' | 'stopped' | 'level_changed';
}

/**
 * Batch player update payload
 */
export interface BatchPlayerUpdatePayload {
  tournament_id: number;
  players: RealtimePlayer[];
  action: 'bulk_update' | 'placement_update';
}

/**
 * Player knockout event
 */
export interface PlayerKnockoutPayload {
  tournament_id: number;
  eliminated_player: RealtimePlayer;
  eliminator_player: RealtimePlayer;
  ko_position: number;
}

/**
 * Check-in event payload
 */
export interface CheckInPayload {
  tournament_id: number;
  player: RealtimePlayer;
  timestamp: Date | string;
}

/**
 * Suit counts for reactions
 */
export interface SuitCounts {
  heart: number;
  diamond: number;
  club: number;
  spade: number;
}

export type ReactionType = 'heart' | 'diamond' | 'club' | 'spade';

/**
 * Reaction update payload for real-time reaction broadcasts
 */
export interface ReactionUpdatePayload {
  tournament_id: number;
  feed_item_id: string;
  totals: SuitCounts;
}

/**
 * Feed item payload for real-time feed updates
 */
export interface FeedItemPayload {
  tournament_id: number;
  item: {
    id: number | string; // string for synthetic knockout IDs like "ko-123"
    item_type: 'knockout' | 'message' | 'checkin' | 'system' | 'td_message';
    author_uid: string | null;
    author_name: string | null;
    message_text: string | null;
    eliminated_player_name: string | null;
    hitman_name: string | null;
    ko_position: number | null;
    created_at: string;
  };
}

/**
 * Error event payload
 */
export interface SocketErrorPayload {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Room join/leave payload
 */
export interface RoomPayload {
  tournament_id: number;
  room_name: string;
  user_count?: number;
}

/**
 * Server to Client Events
 * These are events the server emits to clients
 */
export interface ServerToClientEvents {
  // Player events
  'player:added': (payload: PlayerUpdatePayload) => void;
  'player:updated': (payload: PlayerUpdatePayload) => void;
  'player:removed': (payload: PlayerUpdatePayload) => void;
  'player:checked_in': (payload: CheckInPayload) => void;
  'player:knockout': (payload: PlayerKnockoutPayload) => void;
  'player:eliminated': (payload: PlayerKnockoutPayload) => void;
  'players:updated': (payload: BatchPlayerUpdatePayload) => void;
  'players:batch_update': (payload: BatchPlayerUpdatePayload) => void;
  // Legacy event for backwards compatibility with gameview
  'updatePlayers': (players: unknown[]) => void;

  // Tournament events
  'tournament:updated': (payload: TournamentUpdatePayload) => void;
  'tournament:status_changed': (payload: TournamentUpdatePayload) => void;
  'tournament:finalized': (payload: TournamentUpdatePayload) => void;
  'tournament:full_state': (payload: TournamentGameState) => void;
  'venue:updated': (payload: TournamentUpdatePayload) => void;

  // Feed events
  'feed:new_item': (payload: FeedItemPayload) => void;
  'feed:reaction_update': (payload: ReactionUpdatePayload) => void;

  // Timer events
  'timer:updated': (payload: TimerUpdatePayload) => void;
  'timer:started': (payload: TimerUpdatePayload) => void;
  'timer:paused': (payload: TimerUpdatePayload) => void;
  'timer:resumed': (payload: TimerUpdatePayload) => void;
  'timer:stopped': (payload: TimerUpdatePayload) => void;
  'timer:level_changed': (payload: TimerUpdatePayload) => void;

  // Room events
  'room:joined': (payload: RoomPayload) => void;
  'room:left': (payload: RoomPayload) => void;
  'room:user_count': (payload: RoomPayload) => void;

  // Error events
  'error': (payload: SocketErrorPayload) => void;

  // Connection events
  'connected': (data: { socketId: string; timestamp: Date | string }) => void;
  'disconnected': (data: { reason: string; timestamp: Date | string }) => void;
}

/**
 * Client to Server Events
 * These are events clients emit to the server
 */
export interface ClientToServerEvents {
  // Room management
  'room:join': (
    data: { tournament_id: number; room_name?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'room:leave': (
    data: { tournament_id: number; room_name?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  // Player actions
  'player:add': (
    data: { tournament_id: number; player: Partial<RealtimePlayer> },
    callback?: (response: { success: boolean; player?: RealtimePlayer; error?: string }) => void
  ) => void;
  'player:update': (
    data: { tournament_id: number; player_id: number; updates: Partial<RealtimePlayer> },
    callback?: (response: { success: boolean; player?: RealtimePlayer; error?: string }) => void
  ) => void;
  'player:remove': (
    data: { tournament_id: number; player_id: number },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'player:check_in': (
    data: { tournament_id: number; player_name: string; player_uid?: string },
    callback?: (response: { success: boolean; player?: RealtimePlayer; error?: string }) => void
  ) => void;

  // Tournament actions
  'tournament:update': (
    data: { tournament_id: number; updates: Partial<RealtimeTournament> },
    callback?: (response: { success: boolean; tournament?: RealtimeTournament; error?: string }) => void
  ) => void;
  'tournament:finalize': (
    data: { tournament_id: number },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'tournament:get_state': (
    data: { tournament_id: number },
    callback?: (response: { success: boolean; state?: TournamentGameState; error?: string }) => void
  ) => void;

  // Timer actions
  'timer:start': (
    data: { tournament_id: number },
    callback?: (response: { success: boolean; timer?: RealtimeTimerState; error?: string }) => void
  ) => void;
  'timer:pause': (
    data: { tournament_id: number },
    callback?: (response: { success: boolean; timer?: RealtimeTimerState; error?: string }) => void
  ) => void;
  'timer:resume': (
    data: { tournament_id: number },
    callback?: (response: { success: boolean; timer?: RealtimeTimerState; error?: string }) => void
  ) => void;
  'timer:stop': (
    data: { tournament_id: number },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'timer:set_level': (
    data: { tournament_id: number; level: number },
    callback?: (response: { success: boolean; timer?: RealtimeTimerState; error?: string }) => void
  ) => void;

  // Ping
  'ping': (callback?: (response: { pong: boolean; timestamp: Date | string }) => void) => void;
}

/**
 * Socket.IO Server Inter-Server Events
 * For communication between Socket.IO server instances (if using adapter)
 */
export interface InterServerEvents {
  'tournament:broadcast': (payload: TournamentUpdatePayload) => void;
  'player:broadcast': (payload: PlayerUpdatePayload) => void;
}

/**
 * Socket.IO Socket Data
 * Data stored on each socket connection
 */
export interface SocketData {
  user_id?: string;
  tournament_id?: number;
  rooms: string[];
  connected_at: Date;
}

/**
 * Type for Socket.IO server instance
 */
export type TypedServer = {
  to: (room: string) => {
    emit: <K extends keyof ServerToClientEvents>(
      event: K,
      ...args: Parameters<ServerToClientEvents[K]>
    ) => boolean;
  };
  emit: <K extends keyof ServerToClientEvents>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ) => boolean;
};

/**
 * Type for Socket.IO socket instance
 */
export type TypedSocket = {
  id: string;
  data: SocketData;
  join: (room: string) => Promise<void> | void;
  leave: (room: string) => Promise<void> | void;
  emit: <K extends keyof ServerToClientEvents>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ) => boolean;
  on: <K extends keyof ClientToServerEvents>(
    event: K,
    listener: ClientToServerEvents[K]
  ) => void;
};

/**
 * Utility type for socket event callbacks
 */
export type SocketCallback<T = unknown> = (response: {
  success: boolean;
  data?: T;
  error?: string;
}) => void;

/**
 * Room name generators
 */
export const SocketRooms = {
  tournament: (tournamentId: number) => `tournament:${tournamentId}`,
  admin: (tournamentId: number) => `admin:${tournamentId}`,
  gameView: (token: string) => `gameview:${token}`,
  checkIn: (token: string) => `checkin:${token}`,
} as const;
