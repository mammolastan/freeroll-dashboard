// lib/tdActions.ts

/**
 * TD Action Log System - Types & Action Definitions
 *
 * This is the central registry of all TD action types for the undo system.
 * Every meaningful mutation a Tournament Director performs during a live game
 * is recorded as a typed, reversible command.
 */

export type TDActionType =
  | "PLAYER_ADDED"
  | "PLAYER_REMOVED"
  | "PLAYER_CHECKED_IN"
  | "KO_ASSIGNED"
  | "PLACEMENT_SET";

export interface TDActionLogEntry {
  id: number;
  game_uid: string;
  sequence_num: number;
  action_type: TDActionType;
  description: string;
  actor_uid: string;
  payload: Record<string, unknown>;
  reverse_payload: Record<string, unknown>;
  status: "applied" | "undone";
  performed_at: string;
  undone_at: string | null;
  undone_by: string | null;
}

// What the client sends to the action API
export interface TDActionRequest {
  game_uid: string;
  action_type: TDActionType;
  payload: Record<string, unknown>;
  actor_uid: string;
}

/**
 * Payload shapes per action type (documented for reference)
 *
 * PLAYER_ADDED
 *   payload:        { player_uid, player_name, player_nickname, is_new_player, added_by }
 *   reverse_payload: { tournament_draft_player_id }  <- the id of the row to DELETE on undo
 *
 * PLAYER_REMOVED
 *   payload:        { tournament_draft_player_id }
 *   reverse_payload: { full snapshot of tournament_draft_players row before deletion }
 *
 * PLAYER_CHECKED_IN
 *   payload:        { tournament_draft_player_id, checked_in_at }
 *   reverse_payload: { tournament_draft_player_id, previous_checked_in_at: null | string }
 *
 * KO_ASSIGNED
 *   payload:        { tournament_draft_player_id, player_name, ko_position, hitman_name, hitman_uid }
 *   reverse_payload: { tournament_draft_player_id, previous_ko_position, previous_hitman_name, previous_hitman_uid, previous_knockedout_at, previous_status }
 *   NOTE: capture the BEFORE state at action time, not at undo time
 *
 * PLACEMENT_SET
 *   payload:        { tournament_draft_player_id, player_name, placement }
 *   reverse_payload: { tournament_draft_player_id, previous_placement }
 */

// Helper to generate human-readable descriptions for each action type
export function generateActionDescription(
  actionType: TDActionType,
  payload: Record<string, unknown>
): string {
  switch (actionType) {
    case "PLAYER_ADDED":
      return `Added ${payload.player_name} to the tournament`;
    case "PLAYER_REMOVED":
      return `Removed ${payload.player_name} from the tournament`;
    case "PLAYER_CHECKED_IN":
      return `Checked in ${payload.player_name}`;
    case "KO_ASSIGNED":
      return `${payload.player_name} knocked out${payload.hitman_name ? ` by ${payload.hitman_name}` : ""}`;
    case "PLACEMENT_SET":
      return `Set placement #${payload.placement} for ${payload.player_name}`;
    default:
      return `Unknown action: ${actionType}`;
  }
}
