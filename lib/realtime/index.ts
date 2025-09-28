// lib/realtime/index.ts

// Export types
export * from "./types";

// Export services
export { TournamentService } from "./services/tournamentService";
export { PlayersService } from "./services/playersService";

// Export events
export { PlayerEvents } from "./events/playerEvents";
export { TournamentEvents } from "./events/tournamentEvents";

// Export broadcast manager
export { BroadcastManager } from "./broadcastManager";

// Convenience functions for API routes
export class RealtimeAPI {
  // Player events
  static async playerAdded(tournamentId: number, playerId?: number) {
    const { PlayerEvents } = await import("./events/playerEvents");
    return PlayerEvents.handlePlayerAdded(tournamentId, playerId);
  }

  static async playerUpdated(tournamentId: number, playerId: number) {
    const { PlayerEvents } = await import("./events/playerEvents");
    return PlayerEvents.handlePlayerUpdated(tournamentId, playerId);
  }

  static async playerEliminated(
    tournamentId: number,
    playerId: number,
    eliminatedByPlayerId: number,
    position: number
  ) {
    const { PlayerEvents } = await import("./events/playerEvents");
    return PlayerEvents.handlePlayerEliminated(tournamentId, playerId, eliminatedByPlayerId, position);
  }

  static async playerRemoved(tournamentId: number) {
    const { PlayerEvents } = await import("./events/playerEvents");
    return PlayerEvents.handlePlayerRemoved(tournamentId);
  }

  static async batchPlayerUpdate(tournamentId: number) {
    const { PlayerEvents } = await import("./events/playerEvents");
    return PlayerEvents.handleBatchPlayerUpdate(tournamentId);
  }

  // Tournament events
  static async tournamentUpdated(tournamentId: number) {
    const { TournamentEvents } = await import("./events/tournamentEvents");
    return TournamentEvents.handleTournamentUpdated(tournamentId);
  }

  static async venueUpdated(tournamentId: number) {
    const { TournamentEvents } = await import("./events/tournamentEvents");
    return TournamentEvents.handleVenueUpdated(tournamentId);
  }

  static async tournamentStatusChanged(
    tournamentId: number,
    newStatus: 'draft' | 'active' | 'completed'
  ) {
    const { TournamentEvents } = await import("./events/tournamentEvents");
    return TournamentEvents.handleTournamentStatusChanged(tournamentId, newStatus);
  }
}