// lib/realtime/broadcastManager.ts

import {
  RealtimeEvent,
  RealtimeEventType,
  Player,
  Tournament
} from "./types";
import { TypedServer } from "@/types";

declare global {
  var socketIoInstance: TypedServer | undefined;
}

export class BroadcastManager {
  private static instance: BroadcastManager;

  static getInstance(): BroadcastManager {
    if (!BroadcastManager.instance) {
      BroadcastManager.instance = new BroadcastManager();
    }
    return BroadcastManager.instance;
  }

  broadcast<T>(event: RealtimeEvent<T>): void {
    try {
      if (!global.socketIoInstance) {
        console.error("Socket.IO instance not available for broadcasting");
        return;
      }

      const room = event.tournamentId.toString();
      console.log(`[BROADCAST] ${event.type} to room ${room}:`, event.data);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.socketIoInstance.to(room) as any).emit(event.type, {
        tournamentId: event.tournamentId,
        data: event.data,
        timestamp: event.timestamp
      });
    } catch (error) {
      console.error("Error broadcasting event:", error);
    }
  }

  createEvent<T>(
    type: RealtimeEventType,
    tournamentId: number,
    data: T
  ): RealtimeEvent<T> {
    return {
      type,
      tournamentId,
      data,
      timestamp: new Date()
    };
  }

  // Convenience methods for specific event types
  broadcastTournamentUpdate(tournamentId: number, tournament: Tournament): void {
    const event = this.createEvent('tournament:updated', tournamentId, { tournament });
    this.broadcast(event);
  }

  broadcastPlayersUpdate(tournamentId: number, players: Player[]): void {
    const event = this.createEvent('players:updated', tournamentId, { players });
    this.broadcast(event);
  }

  broadcastPlayerElimination(
    tournamentId: number,
    player: Player,
    eliminatedBy: Player | { id: number | null; name: string; nickname: string | null } | undefined,
    position: number
  ): void {
    const event = this.createEvent('player:eliminated', tournamentId, {
      player,
      eliminatedBy: eliminatedBy ?? null,
      position
    });
    this.broadcast(event);
  }

  broadcastPlayerAdded(tournamentId: number, player: Player): void {
    const event = this.createEvent('player:added', tournamentId, { player });
    this.broadcast(event);
  }

  broadcastVenueUpdate(tournamentId: number, venue: Tournament['venue']): void {
    const event = this.createEvent('venue:updated', tournamentId, { venue });
    this.broadcast(event);
  }
}