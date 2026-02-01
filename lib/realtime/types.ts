// lib/realtime/types.ts

export interface Player {
  id: number;
  name: string;
  nickname: string | null;
  uid: string | null;
  is_new_player: boolean;
  checked_in_at: Date | null;
  created_at: Date;
  is_active: boolean;
  eliminated_at: Date | null;
  eliminated_by_player_id: number | null;
  elimination_position: number | null; // ko_position in DB
  placement: number | null; // placement in DB
  photo_url: string | null;
  hitman?: {
    id: number | null;
    name: string; // hitman_name in DB
    nickname: string | null;
  };
}

export interface Tournament {
  id: number;
  title: string;
  date: Date;
  time: string | null; // tournament_time field
  venue: string | null; // Just a text field
  status: 'draft' | 'active' | 'completed';
  max_players: number | null;
  start_points: number;
  td: string | null; // tournament director name
}

export interface GameViewData {
  tournament: Tournament;
  players: Player[];
  // Computed locally:
  // - totalPlayers: players.length
  // - activePlayers: players.filter(p => p.is_active).length
  // - eliminatedPlayers: players.filter(p => !p.is_active).length
}

export type RealtimeEventType =
  | 'tournament:updated'
  | 'players:updated'
  | 'player:eliminated'
  | 'player:added'
  | 'venue:updated'
  | 'feed:new_item';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  tournamentId: number;
  data: T;
  timestamp: Date;
}

// Specific event data types
export interface TournamentUpdatedEvent {
  tournament: Tournament;
}

export interface PlayersUpdatedEvent {
  players: Player[];
}

export interface PlayerEliminatedEvent {
  player: Player;
  eliminatedBy: Player;
  position: number;
}

export interface PlayerAddedEvent {
  player: Player;
}

export interface VenueUpdatedEvent {
  venue: Tournament['venue'];
}