// components/td/HitmanClaimsDrawer.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Skull, Check, XCircle, Loader2, RefreshCw } from "lucide-react";

interface PendingClaim {
  knockout_player_id: number;
  eliminated_player_name: string;
  eliminated_player_uid: string | null;
  ko_position: number | null;
  knockedout_at: string;
  claimer_uid: string;
  claimer_name: string;
  claimed_at: string;
}

interface HitmanClaimsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: number;
  onClaimsUpdated?: () => void;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return formatTime(isoString);
}

export function HitmanClaimsDrawer({
  isOpen,
  onClose,
  tournamentId,
  onClaimsUpdated,
}: HitmanClaimsDrawerProps) {
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/tournament-drafts/${tournamentId}/hitman-claims`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch claims");
      }
      const data = await response.json();
      setClaims(data.claims || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (isOpen) {
      fetchClaims();
    }
  }, [isOpen, fetchClaims]);

  const handleReview = async (
    knockoutPlayerId: number,
    action: "approve" | "reject"
  ) => {
    setProcessingId(knockoutPlayerId);
    try {
      const response = await fetch(
        `/api/tournament-drafts/${tournamentId}/hitman-claims/${knockoutPlayerId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} claim`);
      }

      // Remove the claim from the list
      setClaims((prev) =>
        prev.filter((c) => c.knockout_player_id !== knockoutPlayerId)
      );

      // Notify parent that claims were updated
      if (onClaimsUpdated) {
        onClaimsUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} claim`);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

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
            <Skull className="w-5 h-5 text-orange-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Hitman Claims
              </h2>
              <p className="text-sm text-gray-400">
                {claims.length} pending {claims.length === 1 ? "claim" : "claims"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchClaims}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-400 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Claims list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Skull className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending claims</p>
              <p className="text-sm mt-1 text-gray-600">
                Players can claim knockouts from the game feed
              </p>
            </div>
          ) : (
            claims.map((claim) => {
              const isProcessing = processingId === claim.knockout_player_id;

              return (
                <div
                  key={claim.knockout_player_id}
                  className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                >
                  {/* Claim info */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-red-400 font-medium">
                        {claim.eliminated_player_name}
                      </span>
                      <span className="text-gray-500">KO&apos;d by</span>
                      <span className="text-cyan-400 font-medium">
                        {claim.claimer_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {claim.ko_position && (
                        <span>KO #{claim.ko_position}</span>
                      )}
                      <span>Claimed {formatRelativeTime(claim.claimed_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleReview(claim.knockout_player_id, "approve")
                      }
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg border border-green-500/50 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        handleReview(claim.knockout_player_id, "reject")
                      }
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg border border-red-500/50 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500">
            Approving a claim assigns the hitman credit. Rejecting allows others to claim.
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

// Floating button component to trigger the drawer
interface HitmanClaimsButtonProps {
  pendingCount: number;
  onClick: () => void;
}

export function HitmanClaimsButton({
  pendingCount,
  onClick,
}: HitmanClaimsButtonProps) {
  if (pendingCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-full shadow-lg transition-all animate-bounce-gentle"
    >
      <Skull className="w-5 h-5" />
      <span className="font-medium">
        {pendingCount} Claim{pendingCount !== 1 ? "s" : ""}
      </span>

      <style jsx>{`
        @keyframes bounce-gentle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s ease-in-out infinite;
        }
      `}</style>
    </button>
  );
}
