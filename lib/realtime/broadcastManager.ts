// lib/realtime/broadcastManager.ts

import {
  RealtimeEvent,
  RealtimeEventType,
  Player,
  Tournament
} from "./types";
import { TypedServer } from "@/types";
import { FeedItemPayload, ReactionUpdatePayload, SuitCounts } from "@/types";

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

  /**
   * Broadcast a new feed item to all clients viewing the tournament
   */
  broadcastFeedItem(tournamentId: number, item: FeedItemPayload['item']): void {
    try {
      if (!global.socketIoInstance) {
        console.error("Socket.IO instance not available for broadcasting feed item");
        return;
      }

      const room = tournamentId.toString();
      const payload: FeedItemPayload = {
        tournament_id: tournamentId,
        item,
      };

      console.log(`[BROADCAST] feed:new_item to room ${room}:`, payload);

      global.socketIoInstance.to(room).emit('feed:new_item', payload);
    } catch (error) {
      console.error("Error broadcasting feed item:", error);
    }
  }

  /**
   * Broadcast a reaction update to all clients viewing the tournament
   */
  broadcastReactionUpdate(tournamentId: number, feedItemId: string, totals: SuitCounts): void {
    try {
      if (!global.socketIoInstance) {
        console.error("Socket.IO instance not available for broadcasting reaction update");
        return;
      }

      const room = tournamentId.toString();
      const payload: ReactionUpdatePayload = {
        tournament_id: tournamentId,
        feed_item_id: feedItemId,
        totals,
      };

      console.log(`[BROADCAST] feed:reaction_update to room ${room}:`, payload);

      global.socketIoInstance.to(room).emit('feed:reaction_update', payload);
    } catch (error) {
      console.error("Error broadcasting reaction update:", error);
    }
  }

}