// hooks/useTDActionHistory.ts

"use client";

import { useState, useEffect, useCallback } from "react";
import { socket } from "@/lib/socketClient";
import { TDActionLogEntry } from "@/lib/tdActions";

// Socket event structure from BroadcastManager
interface ActionLogSocketEvent {
  tournamentId: number;
  data: {
    game_uid: string;
    actions: TDActionLogEntry[];
  };
  timestamp: Date;
}

interface UseTDActionHistoryOptions {
  onUndoSuccess?: (description: string) => void;
  onUndoError?: (reason: string) => void;
}

export function useTDActionHistory(
  game_uid: string | null,
  options?: UseTDActionHistoryOptions
) {
  const [actions, setActions] = useState<TDActionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial history on mount
  useEffect(() => {
    if (!game_uid) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/td/action-log/${game_uid}`);
        if (!response.ok) {
          throw new Error("Failed to fetch action history");
        }
        const data = await response.json();
        setActions(data.actions || []);
      } catch (err) {
        console.error("Error fetching action history:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [game_uid]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!game_uid) return;

    const handleActionLogUpdate = (event: ActionLogSocketEvent) => {
      console.log("[ActionHistory] Received socket event:", event);
      // Extract data from the nested structure
      const { data } = event;
      if (data.game_uid === game_uid) {
        console.log("[ActionHistory] Updating actions:", data.actions.length);
        setActions([...data.actions]); // Spread for React re-render
      }
    };

    socket.on("td:action_log_updated", handleActionLogUpdate);

    return () => {
      socket.off("td:action_log_updated", handleActionLogUpdate);
    };
  }, [game_uid]);

  const lastAppliedAction = actions.find((a) => a.status === "applied") ?? null;
  const canUndo = lastAppliedAction !== null && !isUndoing && !!game_uid;

  const triggerUndo = useCallback(async () => {
    if (!game_uid || !canUndo) {
      options?.onUndoError?.("Nothing to undo");
      return { success: false, reason: "cannot_undo" };
    }

    setIsUndoing(true);
    try {
      const response = await fetch(`/api/td/action-log/${game_uid}/undo`, {
        method: "POST",
      });
      const data = await response.json();

      if (!data.success) {
        console.log("Undo failed:", data.reason);
        options?.onUndoError?.(data.reason || "Undo failed");
        return { success: false, reason: data.reason };
      }

      // Socket will update actions list automatically, but we can also update locally
      // for immediate feedback
      setActions((prev) =>
        prev.map((a) =>
          a.id === data.undone_action?.id ? { ...a, status: "undone" as const } : a
        )
      );

      // Call success callback
      options?.onUndoSuccess?.(data.description || "Action undone");

      return {
        success: true,
        description: data.description,
        undone_action: data.undone_action,
      };
    } catch (err) {
      console.error("Error undoing action:", err);
      options?.onUndoError?.("Failed to undo action");
      return { success: false, reason: "error" };
    } finally {
      setIsUndoing(false);
    }
  }, [game_uid, canUndo, options]);

  // Ctrl+Z / Cmd+Z handler - must be after triggerUndo is defined
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Check if we're in an input field or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return; // Don't intercept undo in form fields
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        triggerUndo();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [triggerUndo]);

  const refreshHistory = useCallback(async () => {
    if (!game_uid) return;

    try {
      const response = await fetch(`/api/td/action-log/${game_uid}`);
      if (response.ok) {
        const data = await response.json();
        setActions(data.actions || []);
      }
    } catch (err) {
      console.error("Error refreshing action history:", err);
    }
  }, [game_uid]);

  // Undo a specific action by ID
  const undoAction = useCallback(async (actionId: number) => {
    if (!game_uid) {
      options?.onUndoError?.("No game context");
      return { success: false, reason: "no_game_uid" };
    }

    setIsUndoing(true);
    try {
      const response = await fetch(`/api/td/action-log/${game_uid}/undo/${actionId}`, {
        method: "POST",
      });
      const data = await response.json();

      if (!data.success) {
        console.log("Undo failed:", data.reason);
        options?.onUndoError?.(data.description || data.reason || "Undo failed");
        return { success: false, reason: data.reason };
      }

      // Update local state
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId ? { ...a, status: "undone" as const } : a
        )
      );

      options?.onUndoSuccess?.(data.description || "Action undone");

      return {
        success: true,
        description: data.description,
        undone_action: data.undone_action,
      };
    } catch (err) {
      console.error("Error undoing action:", err);
      options?.onUndoError?.("Failed to undo action");
      return { success: false, reason: "error" };
    } finally {
      setIsUndoing(false);
    }
  }, [game_uid, options]);

  // Find and undo a player's KO action
  const undoPlayerKO = useCallback(async (playerId: number) => {
    // Find the most recent applied KO_ASSIGNED action for this player
    const koAction = actions.find(
      (a) =>
        a.status === "applied" &&
        a.action_type === "KO_ASSIGNED" &&
        (a.payload as { tournament_draft_player_id?: number }).tournament_draft_player_id === playerId
    );

    if (!koAction) {
      options?.onUndoError?.("No KO action found for this player");
      return { success: false, reason: "no_ko_action" };
    }

    return undoAction(koAction.id);
  }, [actions, undoAction, options]);

  return {
    actions,
    lastAppliedAction,
    canUndo,
    triggerUndo,
    undoAction,
    undoPlayerKO,
    isUndoing,
    isLoading,
    error,
    refreshHistory,
  };
}
