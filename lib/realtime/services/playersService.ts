// lib/realtime/services/playersService.ts

import { Player } from "../types";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

export class PlayersService {
  async getTournamentPlayers(tournamentId: number): Promise<Player[]> {
    try {
      const players = await prisma.$queryRaw<RawQueryResult[]>`
        SELECT tdp.*, p.photo_url
        FROM tournament_draft_players tdp
        LEFT JOIN players p ON tdp.player_uid = p.UID
        WHERE tdp.tournament_draft_id = ${tournamentId}
        ORDER BY tdp.created_at ASC
      `;

      return players.map((p) => ({
        id: p.id as number,
        name: p.player_name as string,
        nickname: p.player_nickname as string | null,
        uid: p.player_uid as string | null,
        is_new_player: p.is_new_player as boolean,
        checked_in_at: p.checked_in_at as Date | null,
        created_at: p.created_at as Date,
        is_active: p.ko_position === null, // Active if no ko_position
        eliminated_at: null,
        eliminated_by_player_id: null,
        elimination_position: p.ko_position as number | null,
        placement: p.placement as number | null,
        photo_url: p.photo_url as string | null,
        hitman: p.hitman_name
          ? {
              id: null,
              name: p.hitman_name as string,
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
