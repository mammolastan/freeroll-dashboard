// components/td/HitmanClaimsDrawer.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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

interface PendingReport {
  victim_player_id: number;
  victim_name: string;
  victim_uid: string | null;
  hitman_uid: string | null;
  hitman_name: string | null;
  reporter_uid: string;
  reporter_name: string | null;
  reported_at: string;
}

// Unified item type for the combined list
type PendingItem =
  | { type: "claim"; data: PendingClaim; timestamp: Date }
  | { type: "report"; data: PendingReport; timestamp: Date };

interface HitmanClaimsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: number;
  onClaimsUpdated?: () => void;
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
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function HitmanClaimsDrawer({
  isOpen,
  onClose,
  tournamentId,
  onClaimsUpdated,
}: HitmanClaimsDrawerProps) {
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Combine and sort claims and reports by timestamp (oldest first)
  const pendingItems = useMemo<PendingItem[]>(() => {
    const items: PendingItem[] = [
      ...claims.map((c) => ({
        type: "claim" as const,
        data: c,
        timestamp: new Date(c.claimed_at),
      })),
      ...reports.map((r) => ({
        type: "report" as const,
        data: r,
        timestamp: new Date(r.reported_at),
      })),
    ];
    // Sort by timestamp ascending (oldest first, so TD handles them in order)
    return items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [claims, reports]);

  const fetchClaims = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/tournament-drafts/${tournamentId}/hitman-claims`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch claims");
      }
      const data = await response.json();
      setClaims(data.claims || []);
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    }
  }, [tournamentId]);

  const fetchReports = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/tournament-drafts/${tournamentId}/knockout-reports`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }
      const data = await response.json();
      setReports(data.reports || []);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  }, [tournamentId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchClaims(), fetchReports()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [fetchClaims, fetchReports]);

  useEffect(() => {
    if (isOpen) {
      fetchAll();
    }
  }, [isOpen, fetchAll]);

  const handleReviewClaim = async (
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

  const handleReviewReport = async (
    victimPlayerId: number,
    action: "approve" | "reject"
  ) => {
    setProcessingId(victimPlayerId);
    try {
      const response = await fetch(
        `/api/tournament-drafts/${tournamentId}/knockout-reports/${victimPlayerId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} report`);
      }

      // Remove the report from the list
      setReports((prev) =>
        prev.filter((r) => r.victim_player_id !== victimPlayerId)
      );

      // Notify parent that reports were updated
      if (onClaimsUpdated) {
        onClaimsUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} report`);
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
                Knockout Reviews
              </h2>
              <p className="text-sm text-gray-400">
                {pendingItems.length} pending
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
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

        {/* Combined list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Skull className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending reviews</p>
              <p className="text-sm mt-1 text-gray-600">
                Claims and reports will appear here
              </p>
            </div>
          ) : (
            pendingItems.map((item) => {
              if (item.type === "claim") {
                const claim = item.data;
                const isProcessing = processingId === claim.knockout_player_id;

                return (
                  <div
                    key={`claim-${claim.knockout_player_id}`}
                    className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    {/* Type badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded font-medium">
                        Claim
                      </span>
                      {claim.ko_position && (
                        <span className="text-xs text-gray-500">
                          KO #{claim.ko_position}
                        </span>
                      )}
                    </div>

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
                      <div className="mt-1 text-xs text-gray-500">
                        {formatRelativeTime(claim.claimed_at)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleReviewClaim(claim.knockout_player_id, "approve")
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
                          handleReviewClaim(claim.knockout_player_id, "reject")
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
              } else {
                const report = item.data;
                const isProcessing = processingId === report.victim_player_id;

                return (
                  <div
                    key={`report-${report.victim_player_id}`}
                    className="p-4 bg-gray-800 rounded-lg border border-orange-500/30"
                  >
                    {/* Type badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded font-medium">
                        Report
                      </span>
                      <span className="text-xs text-gray-500">
                        by {report.reporter_name || "Player"}
                      </span>
                    </div>

                    {/* Report info */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-400 font-medium">
                          {report.victim_name}
                        </span>
                        <span className="text-gray-500">KO&apos;d by</span>
                        <span className="text-cyan-400 font-medium">
                          {report.hitman_name || "Unknown"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatRelativeTime(report.reported_at)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleReviewReport(report.victim_player_id, "approve")
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
                          handleReviewReport(report.victim_player_id, "reject")
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
              }
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500">
            <strong>Claims:</strong> Player claims credit for an existing KO.{" "}
            <strong>Reports:</strong> Player reports a new KO (eliminates victim if approved).
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
        {pendingCount} to Review
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
