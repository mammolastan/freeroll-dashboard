// lib/realtime/events/tournamentEvents.ts

import { BroadcastManager } from "../broadcastManager";
import { TournamentService } from "../services/tournamentService";

const tournamentService = new TournamentService();
const broadcast = BroadcastManager.getInstance();

export class TournamentEvents {
  static async handleTournamentUpdated(tournamentId: number): Promise<void> {
    try {
      console.log(`[TOURNAMENT_EVENTS] Tournament ${tournamentId} updated`);

      // Get updated tournament data
      const tournament = await tournamentService.getTournamentData(tournamentId);

      if (tournament) {
        // Broadcast the updated tournament data
        broadcast.broadcastTournamentUpdate(tournamentId, tournament);
      }
    } catch (error) {
      console.error("Error handling tournament updated event:", error);
    }
  }

  static async handleVenueUpdated(tournamentId: number): Promise<void> {
    try {
      console.log(`[TOURNAMENT_EVENTS] Venue updated for tournament ${tournamentId}`);

      // Get updated tournament data (includes venue)
      const tournament = await tournamentService.getTournamentData(tournamentId);

      if (tournament) {
        // Broadcast venue update
        broadcast.broadcastVenueUpdate(tournamentId, tournament.venue);

        // Also broadcast full tournament update
        broadcast.broadcastTournamentUpdate(tournamentId, tournament);
      }
    } catch (error) {
      console.error("Error handling venue updated event:", error);
    }
  }

  static async handleTournamentStatusChanged(
    tournamentId: number,
    newStatus: 'draft' | 'active' | 'completed'
  ): Promise<void> {
    try {
      console.log(`[TOURNAMENT_EVENTS] Tournament ${tournamentId} status changed to ${newStatus}`);

      // Update tournament status
      const tournament = await tournamentService.updateTournament(tournamentId, { status: newStatus });

      if (tournament) {
        // Broadcast the updated tournament data
        broadcast.broadcastTournamentUpdate(tournamentId, tournament);
      }
    } catch (error) {
      console.error("Error handling tournament status change:", error);
    }
  }
}