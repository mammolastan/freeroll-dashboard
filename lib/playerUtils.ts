// lib/playerUtils.ts
// Utility functions for handling player name fields after migration to players_v2

/**
 * Get a display name from a player with first_name and last_name fields.
 * Falls back to 'Unknown' if both fields are empty.
 */
export function getDisplayName(player: { first_name?: string | null; last_name?: string | null }): string {
  return [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Unknown';
}

/**
 * Parse a full name string into first_name and last_name components.
 * The first word becomes first_name, and all remaining words become last_name.
 */
export function parseName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return { first_name: '', last_name: '' };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' ')
  };
}
