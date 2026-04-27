// components/td/ActionHistoryDrawer.tsx

"use client";

import React from "react";
import { X, History, Undo2 } from "lucide-react";
import { TDActionLogEntry, TDActionType } from "@/lib/tdActions";

interface ActionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  actions: TDActionLogEntry[];
  canUndo: boolean;
  onUndo: () => void;
  isUndoing: boolean;
  gameName?: string;
}

// Icon/color mapping for action types
const actionTypeStyles: Record<
  TDActionType,
  { label: string; bgColor: string; textColor: string }
> = {
  PLAYER_ADDED: {
    label: "Added",
    bgColor: "bg-green-500/20",
    textColor: "text-green-400",
  },
  PLAYER_REMOVED: {
    label: "Removed",
    bgColor: "bg-red-500/20",
    textColor: "text-red-400",
  },
  PLAYER_CHECKED_IN: {
    label: "Check-in",
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-400",
  },
  KO_ASSIGNED: {
    label: "KO",
    bgColor: "bg-orange-500/20",
    textColor: "text-orange-400",
  },
  PLACEMENT_SET: {
    label: "Placement",
    bgColor: "bg-purple-500/20",
    textColor: "text-purple-400",
  },
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ActionHistoryDrawer({
  isOpen,
  onClose,
  actions,
  canUndo,
  onUndo,
  isUndoing,
  gameName,
}: ActionHistoryDrawerProps) {
  if (!isOpen) return null;

  const lastAppliedAction = actions.find((a) => a.status === "applied");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Action History
              </h2>
              {gameName && (
                <p className="text-sm text-gray-400">{gameName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700">
          <p className="text-xs text-gray-400">
            Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 font-mono">Ctrl+Z</kbd> to undo the last action
          </p>
        </div>

        {/* Actions list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {actions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No actions recorded yet</p>
            </div>
          ) : (
            actions.map((action) => {
              const style = actionTypeStyles[action.action_type];
              const isUndone = action.status === "undone";
              const isLastApplied = action.id === lastAppliedAction?.id;

              return (
                <div
                  key={action.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    isUndone
                      ? "bg-gray-800/30 border-gray-700/50 opacity-60"
                      : "bg-gray-800 border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Action type badge */}
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${style.bgColor} ${style.textColor}`}
                        >
                          {style.label}
                        </span>

                        {/* Undone indicator */}
                        {isUndone && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Undo2 className="w-3 h-3" />
                            undone
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p
                        className={`text-sm ${
                          isUndone ? "text-gray-500 line-through" : "text-gray-200"
                        }`}
                      >
                        {action.description}
                      </p>

                      {/* Time */}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(action.performed_at)}
                        {isUndone && action.undone_at && (
                          <span className="ml-2">
                            (undone at {formatTime(action.undone_at)})
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Undo button - only for the most recent applied action */}
                    {isLastApplied && canUndo && (
                      <button
                        onClick={onUndo}
                        disabled={isUndoing}
                        className="px-3 py-1.5 text-sm bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 rounded border border-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        {isUndoing ? "Undoing..." : "Undo"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with count */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-sm text-gray-400">
            {actions.filter((a) => a.status === "applied").length} applied,{" "}
            {actions.filter((a) => a.status === "undone").length} undone
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
