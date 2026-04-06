// lib/realtime/services/tournamentService.ts

import { Tournament } from "../types";
import { prisma } from "@/lib/prisma";
import { fetchTournamentRealtimeSnapshot } from "@/lib/fetch-tournament-realtime-snapshot";

export class TournamentService {
  async getTournamentData(tournamentId: number): Promise<Tournament | null> {
    try {
      return await fetchTournamentRealtimeSnapshot(tournamentId);
    } catch (error) {
      console.error("Error fetching tournament data:", error);
      return null;
    }
  }

  async updateTournament(
    tournamentId: number,
    updates: Partial<Tournament>
  ): Promise<Tournament | null> {
    try {
      // Perform update - note: venue updates are not supported via this method
      // since venue is now a relation. Use the admin UI to change venues.
      await prisma.$executeRaw`
        UPDATE tournament_drafts
        SET
          tournament_date = COALESCE(${updates.date}, tournament_date),
          status = COALESCE(${updates.status}, status)
        WHERE id = ${tournamentId}
      `;

      // Return updated data
      return await this.getTournamentData(tournamentId);
    } catch (error) {
      console.error("Error updating tournament:", error);
      return null;
    }
  }
}
