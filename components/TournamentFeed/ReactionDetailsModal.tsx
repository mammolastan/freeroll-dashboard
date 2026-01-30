// components/TournamentFeed/ReactionDetailsModal.tsx

"use client";

import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import PlayerAvatar from "@/components/ui/PlayerAvatar";

interface ReactionDetail {
  user_uid: string;
  name: string | null;
  nickname: string | null;
  photo_url: string | null;
  reaction_type: string;
  count: number;
}

interface UserReactions {
  user_uid: string;
  name: string | null;
  nickname: string | null;
  photo_url: string | null;
  suits: { type: string; symbol: string; color: string; count: number }[];
}

interface ReactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: number;
  feedItemId: string;
}

const SUIT_INFO: Record<string, { symbol: string; color: string }> = {
  club: { symbol: "\u2663", color: "text-green-400" },
  diamond: { symbol: "\u2666", color: "text-blue-400" },
  heart: { symbol: "\u2665", color: "text-red-400" },
  spade: { symbol: "\u2660", color: "text-gray-300" },
};

export function ReactionDetailsModal({
  isOpen,
  onClose,
  tournamentId,
  feedItemId,
}: ReactionDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserReactions[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      fetchDetails();
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournament-drafts/${tournamentId}/feed/${feedItemId}/reactions/details`,
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const details: ReactionDetail[] = data.details;

      // Group by user
      const userMap = new Map<string, UserReactions>();
      for (const d of details) {
        let user = userMap.get(d.user_uid);
        if (!user) {
          user = {
            user_uid: d.user_uid,
            name: d.name,
            nickname: d.nickname,
            photo_url: d.photo_url,
            suits: [],
          };
          userMap.set(d.user_uid, user);
        }
        const info = SUIT_INFO[d.reaction_type];
        if (info) {
          user.suits.push({
            type: d.reaction_type,
            symbol: info.symbol,
            color: info.color,
            count: d.count,
          });
        }
      }

      setUsers(Array.from(userMap.values()));
    } catch {
      setError("Failed to load reaction details");
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-gray-900 border border-cyan-500/30 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.2)] w-full max-w-sm mx-4 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20">
          <h3 className="text-sm font-medium text-cyan-300">Reactions</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-cyan-500 animate-spin" />
            </div>
          )}

          {error && !loading && (
            <p className="text-red-400 text-sm text-center py-4">{error}</p>
          )}

          {!loading && !error && users.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">
              No reactions yet
            </p>
          )}

          {!loading && !error && users.length > 0 && (
            <div className="space-y-2">
              {users.map((user) => {
                const displayName = user.nickname || user.name || "God";
                return (
                  <div
                    key={user.user_uid}
                    className="flex items-center gap-3 p-2 rounded bg-gray-800/50"
                  >
                    {/* Avatar */}
                    {user.photo_url ? (
                      <PlayerAvatar
                        photoUrl={user.photo_url}
                        name={displayName}
                        uid={user.user_uid}
                        size="sm"
                        showFallback={false}
                      />
                    ) : (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-300">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Name */}
                    <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">
                      {displayName}
                    </span>

                    {/* Suit counts */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {user.suits.map((s) => (
                        <span
                          key={s.type}
                          className={`text-sm ${s.color} flex items-center gap-0.5`}
                        >
                          {s.symbol}
                          <span className="text-xs tabular-nums">
                            {s.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
