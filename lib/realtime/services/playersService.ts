// lib/realtime/services/playersService.ts

import { Player } from "../types";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

export class PlayersService {
  async getTournamentPlayers(tournamentId: number): Promise<Player[]> {
    try {
      const players = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT * FROM tournament_draft_players
        WHERE tournament_draft_id = ${tournamentId}
        ORDER BY created_at ASC
      `;

      return players.map((p) => ({
        id: p.id,
        name: p.player_name,
        nickname: p.player_nickname,
        uid: p.player_uid,
        is_new_player: p.is_new_player,
        checked_in_at: p.checked_in_at,
        created_at: p.created_at,
        is_active: p.ko_position === null, // Active if no ko_position
        eliminated_at: null,
        eliminated_by_player_id: null,
        elimination_position: p.ko_position,
        placement: p.placement,
        hitman: p.hitman_name
          ? {
              id: null,
              name: p.hitman_name,
              nickname: null,
            }
          : undefined,
      }));
    } catch (error) {
      console.error("Error fetching tournament players:", error);
      return [];
    }
  }

  async eliminatePlayer(
    tournamentId: number,
    playerId: number,
    eliminatedByPlayerId: number,
    position: number
  ): Promise<Player | null> {
    try {
      await prisma.$executeRaw`
        UPDATE tournament_draft_players
        SET
          is_active = false,
          eliminated_at = NOW(),
          eliminated_by_player_id = ${eliminatedByPlayerId},
          elimination_position = ${position}
        WHERE id = ${playerId} AND tournament_draft_id = ${tournamentId}
      `;

      // Get the updated player
      const players = await this.getTournamentPlayers(tournamentId);
      return players.find((p) => p.id === playerId) || null;
    } catch (error) {
      console.error("Error eliminating player:", error);
      return null;
    }
  }

  async addPlayer(
    tournamentId: number,
    playerData: Partial<Player>
  ): Promise<Player | null> {
    try {
      await prisma.$queryRaw<RawQueryResult[]>`
        INSERT INTO tournament_draft_players
        (tournament_draft_id, player_name, player_nickname, player_uid, is_new_player, is_active)
        VALUES (${tournamentId}, ${playerData.name}, ${playerData.nickname}, ${playerData.uid}, ${playerData.is_new_player}, true)
      `;

      // Get the newly created player
      const players = await this.getTournamentPlayers(tournamentId);
      return players[players.length - 1] || null;
    } catch (error) {
      console.error("Error adding player:", error);
      return null;
    }
  }
}
