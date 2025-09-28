// lib/realtime/services/tournamentService.ts

import { PrismaClient } from "@prisma/client";
import { Tournament } from "../types";

const prisma = new PrismaClient();

export class TournamentService {
  async getTournamentData(tournamentId: number): Promise<Tournament | null> {
    try {
      const tournament = await prisma.$queryRaw`
        SELECT
          id,
          tournament_date,
          director_name,
          venue,
          status
        FROM tournament_drafts
        WHERE id = ${tournamentId}
        LIMIT 1
      `;

      if ((tournament as any[]).length === 0) return null;

      const data = (tournament as any[])[0];
      return {
        id: data.id,
        title: `Tournament ${data.id}`, // No tournament_name field, using fallback
        date: data.tournament_date,
        venue: data.venue,
        status: data.status,
        max_players: null
      };
    } catch (error) {
      console.error("Error fetching tournament data:", error);
      return null;
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateTournament(tournamentId: number, updates: Partial<Tournament>): Promise<Tournament | null> {
    try {
      // Perform update
      await prisma.$executeRaw`
        UPDATE tournament_drafts
        SET
          title = COALESCE(${updates.title}, title),
          date = COALESCE(${updates.date}, date),
          venue = COALESCE(${updates.venue}, venue),
          status = COALESCE(${updates.status}, status),
          max_players = COALESCE(${updates.max_players}, max_players)
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