// lib/realtime/events/playerEvents.ts

import { BroadcastManager } from "../broadcastManager";
import { PlayersService } from "../services/playersService";

const playersService = new PlayersService();
const broadcast = BroadcastManager.getInstance();

export class PlayerEvents {
  static async handlePlayerAdded(tournamentId: number, playerId?: number): Promise<void> {
    try {
      console.log(`[PLAYER_EVENTS] Player added to tournament ${tournamentId}`);

      // Get updated players list
      const players = await playersService.getTournamentPlayers(tournamentId);

      // Broadcast the full updated players list
      broadcast.broadcastPlayersUpdate(tournamentId, players);

      // If we know the specific player, also broadcast that event
      if (playerId) {
        const addedPlayer = players.find(p => p.id === playerId);
        if (addedPlayer) {
          broadcast.broadcastPlayerAdded(tournamentId, addedPlayer);
        }
      }
    } catch (error) {
      console.error("Error handling player added event:", error);
    }
  }

  static async handlePlayerUpdated(tournamentId: number, playerId: number): Promise<void> {
    try {
      console.log(`[PLAYER_EVENTS] Player ${playerId} updated in tournament ${tournamentId}`);

      // Get updated players list
      const players = await playersService.getTournamentPlayers(tournamentId);

      // Broadcast the full updated players list
      broadcast.broadcastPlayersUpdate(tournamentId, players);
    } catch (error) {
      console.error("Error handling player updated event:", error);
    }
  }

  static async handlePlayerEliminated(
    tournamentId: number,
    playerId: number,
    eliminatedByPlayerId: number,
    position: number
  ): Promise<void> {
    try {
      console.log(`[PLAYER_EVENTS] Player ${playerId} eliminated by ${eliminatedByPlayerId} in position ${position}`);

      // Update the player's elimination status
      const eliminatedPlayer = await playersService.eliminatePlayer(
        tournamentId,
        playerId,
        eliminatedByPlayerId,
        position
      );

      if (eliminatedPlayer) {
        // Get updated players list
        const players = await playersService.getTournamentPlayers(tournamentId);

        // Broadcast elimination event
        broadcast.broadcastPlayerElimination(
          tournamentId,
          eliminatedPlayer,
          eliminatedPlayer.hitman,
          position
        );

        // Also broadcast updated players list
        broadcast.broadcastPlayersUpdate(tournamentId, players);
      }
    } catch (error) {
      console.error("Error handling player elimination event:", error);
    }
  }

  static async handlePlayerRemoved(tournamentId: number): Promise<void> {
    try {
      console.log(`[PLAYER_EVENTS] Player removed from tournament ${tournamentId}`);

      // Get updated players list
      const players = await playersService.getTournamentPlayers(tournamentId);

      // Broadcast the full updated players list
      broadcast.broadcastPlayersUpdate(tournamentId, players);
    } catch (error) {
      console.error("Error handling player removed event:", error);
    }
  }

  static async handleBatchPlayerUpdate(tournamentId: number): Promise<void> {
    try {
      console.log(`[PLAYER_EVENTS] Batch player update for tournament ${tournamentId}`);

      // Get updated players list
      const players = await playersService.getTournamentPlayers(tournamentId);

      // Broadcast the full updated players list
      broadcast.broadcastPlayersUpdate(tournamentId, players);
    } catch (error) {
      console.error("Error handling batch player update event:", error);
    }
  }
}