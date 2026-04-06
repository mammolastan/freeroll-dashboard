// lib/realtime/services/tournamentService.ts

import { Tournament } from "../types";
import { prisma } from "@/lib/prisma";

export class TournamentService {
  async getTournamentData(tournamentId: number): Promise<Tournament | null> {
    try {
      const tournament = await prisma.$queryRaw`
        SELECT
          td.id,
          td.tournament_date,
          td.tournament_time,
          td.director_name,
          td.start_points,
          v.name as venue_name,
          td.status
        FROM tournament_drafts td
        LEFT JOIN venues v ON td.venue_id = v.id
        WHERE td.id = ${tournamentId}
        LIMIT 1
      `;

      if (!Array.isArray(tournament) || tournament.length === 0) return null;

      const data = tournament[0] as {
        id: number;
        tournament_date: Date;
        tournament_time: string | null;
        director_name: string;
        start_points: number;
        venue_name: string | null;
        status: string;
      };
      return {
        id: data.id,
        title: `Tournament ${data.id}`, // No tournament_name field, using fallback
        date: data.tournament_date,
        time: data.tournament_time,
        venue: data.venue_name,
        status: data.status as Tournament['status'],
        max_players: null,
        start_points: data.start_points,
        td: data.director_name,
        timezone: 'America/New_York', // Default timezone for legacy service
        allow_chat: true, // Default to allowing chat
      };
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
