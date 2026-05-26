// app/[leagueSlug]/admin/badges/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Award, Search, X, Users } from "lucide-react";

interface BadgeInfo {
  badge_id: string;
  short_description: string;
  long_description: string;
  quote: string;
  criteria: string;
  category: string;
  rarity: number;
  icon: string;
  tier: string | null;
  league: number | null;
  playerCount: number;
}

interface PlayerSearchResult {
  UID: string;
  Name: string;
  nickname: string | null;
  TotalGames: number;
}

export default function BadgesAdminPage() {
  const { leagueSlug } = useParams();
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<BadgeInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  // Badge toggle state
  const [badgesEnabled, setBadgesEnabled] = useState(true);
  const [badgesEnabledLoading, setBadgesEnabledLoading] = useState(true);
  const [badgesToggleSaving, setBadgesToggleSaving] = useState(false);

  // Assign form state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [description, setDescription] = useState("");
  const [earnedAt, setEarnedAt] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch(`/api/${leagueSlug}/badges`);
      if (!res.ok) throw new Error("Failed to fetch badges");
      const data = await res.json();
      setBadges(data.badges);
    } catch (error) {
      console.error("Error fetching badges:", error);
      showToast("Failed to load badges", "error");
    } finally {
      setLoading(false);
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  // Fetch badgesEnabled setting from league config
  useEffect(() => {
    async function fetchBadgesEnabled() {
      try {
        const res = await fetch(`/api/${leagueSlug}/admin/config`);
        if (!res.ok) throw new Error("Failed to fetch config");
        const data = await res.json();
        setBadgesEnabled(data.config?.badgesEnabled ?? true);
      } catch (error) {
        console.error("Error fetching badges enabled setting:", error);
      } finally {
        setBadgesEnabledLoading(false);
      }
    }
    fetchBadgesEnabled();
  }, [leagueSlug]);

  // Toggle badges enabled/disabled
  const handleToggleBadgesEnabled = async () => {
    setBadgesToggleSaving(true);
    const newValue = !badgesEnabled;
    try {
      const res = await fetch(`/api/${leagueSlug}/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgesEnabled: newValue }),
      });
      if (!res.ok) throw new Error("Failed to update config");
      setBadgesEnabled(newValue);
      showToast(
        newValue ? "Badges enabled for this league" : "Badges disabled for this league",
        "success"
      );
    } catch (error) {
      console.error("Error updating badges enabled:", error);
      showToast("Failed to update badge setting", "error");
    } finally {
      setBadgesToggleSaving(false);
    }
  };

  // Debounced player search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(searchQuery)}&name=true`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        // Ignore search errors
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const openBadgeModal = (badge: BadgeInfo) => {
    setSelectedBadge(badge);
    setModalOpen(true);
    setShowAssignForm(false);
    resetAssignForm();
  };

  const closeBadgeModal = () => {
    setModalOpen(false);
    setSelectedBadge(null);
    setShowAssignForm(false);
    resetAssignForm();
  };

  const resetAssignForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedPlayer(null);
    setDescription("");
    setEarnedAt(new Date().toISOString().split("T")[0]);
  };

  const handleAssignBadge = async () => {
    if (!selectedBadge || !selectedPlayer) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/${leagueSlug}/badges/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badgeId: selectedBadge.badge_id,
          playerUid: selectedPlayer.UID,
          description: description.trim() || null,
          earnedAt: earnedAt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign badge");
      }

      showToast(`Badge assigned to ${selectedPlayer.Name}`, "success");
      closeBadgeModal();
      fetchBadges(); // Refresh to update counts
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to assign badge", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRarityLabel = (rarity: number) => {
    if (rarity > 99) return { text: "Legendary", color: "text-amber-400" };
    if (rarity > 66) return { text: "Rare", color: "text-purple-400" };
    if (rarity > 33) return { text: "Uncommon", color: "text-blue-400" };
    return { text: "Common", color: "text-white/60" };
  };

  if (loading) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-bold text-white mb-1">Badges</h2>
        <p className="text-white/40 text-sm mb-8">
          Manage badges for this league
        </p>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">Loading badges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Badges</h2>
        <p className="text-white/40 text-sm">
          View available badges and assign them to players.
          <br />
          Click on a badge to view details and assign it manually.
        </p>
      </div>

      {/* Badges Enabled Toggle */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Display Badges</h3>
            <p className="text-white/40 text-sm mt-0.5">
              When disabled, badges will not be shown anywhere in the app for this league.
            </p>
          </div>
          <button
            onClick={handleToggleBadgesEnabled}
            disabled={badgesEnabledLoading || badgesToggleSaving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed ${
              badgesEnabled ? "bg-cyan-600" : "bg-white/20"
            }`}
            role="switch"
            aria-checked={badgesEnabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                badgesEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Badges List */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
            Available Badges ({badges.length})
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {badges.length === 0 ? (
            <p className="px-4 py-6 text-white/40 text-center text-sm">
              No badges available
            </p>
          ) : (
            badges.map((badge, index) => {
              const rarityInfo = getRarityLabel(badge.rarity);
              const rowBg = index % 2 === 0 ? "bg-white/[0.02]" : "";

              return (
                <div
                  key={badge.badge_id}
                  onClick={() => openBadgeModal(badge)}
                  className={`px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors ${rowBg}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 flex-shrink-0">
                      <img
                        src={`/images/badges/${badge.icon}`}
                        alt={badge.short_description}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium truncate">
                          {badge.short_description}
                        </span>
                        {badge.tier && (
                          <span className="px-1.5 py-0.5 bg-white/10 text-white/60 text-xs rounded">
                            {badge.tier}
                          </span>
                        )}
                        <span className={`text-xs ${rarityInfo.color}`}>
                          {rarityInfo.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-white/40 text-sm">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {badge.playerCount} {badge.playerCount === 1 ? "player" : "players"}
                        </span>
                        <span className="truncate">{badge.category}</span>
                      </div>
                    </div>
                  </div>
                  <Award size={16} className="text-white/20 flex-shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Badge Detail Modal */}
      {modalOpen && selectedBadge && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {selectedBadge.short_description}
              </h3>
              <button
                onClick={closeBadgeModal}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              {/* Badge Preview */}
              <div className="mb-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-24 h-24">
                    <img
                      src={`/images/badges/${selectedBadge.icon}`}
                      alt={selectedBadge.short_description}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="text-center mb-3">
                  <p className={`text-sm ${getRarityLabel(selectedBadge.rarity).color}`}>
                    {getRarityLabel(selectedBadge.rarity).text}
                  </p>
                  {selectedBadge.tier && (
                    <p className="text-white/60 text-sm mt-1">{selectedBadge.tier}</p>
                  )}
                </div>
                <p className="text-white/70 text-sm text-center mb-2">
                  {selectedBadge.criteria}
                </p>
                <p className="text-white/50 text-sm text-center italic">
                  &ldquo;{selectedBadge.quote}&rdquo;
                </p>
                <div className="mt-4 text-center">
                  <span className="inline-flex items-center gap-1 text-white/40 text-sm">
                    <Users size={14} />
                    {selectedBadge.playerCount} {selectedBadge.playerCount === 1 ? "player has" : "players have"} this badge
                  </span>
                </div>
              </div>

              {/* Assign Badge Section */}
              {!showAssignForm ? (
                <button
                  onClick={() => setShowAssignForm(true)}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                >
                  Assign Badge to Player
                </button>
              ) : (
                <div className="border-t border-white/10 pt-5">
                  <h4 className="text-white font-medium mb-4">Assign Badge</h4>

                  {/* Player Search */}
                  <div className="relative mb-4">
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Player *
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setSelectedPlayer(null);
                        }}
                        placeholder="Search for a player..."
                        className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Search Results Dropdown */}
                    {searchQuery.length >= 2 && !selectedPlayer && (
                      <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {isSearching ? (
                          <div className="px-4 py-2 text-white/40">Searching...</div>
                        ) : searchResults.length === 0 ? (
                          <div className="px-4 py-2 text-white/40">No players found</div>
                        ) : (
                          searchResults.map((player) => (
                            <button
                              key={player.UID}
                              onClick={() => {
                                setSelectedPlayer(player);
                                setSearchQuery(player.Name);
                                setSearchResults([]);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-white/10 text-white"
                            >
                              <span className="font-medium">
                                {player.nickname
                                  ? `${player.Name} (${player.nickname})`
                                  : player.Name}
                              </span>
                              <span className="text-white/40 text-sm ml-2">
                                {player.TotalGames} games
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Player Display */}
                  {selectedPlayer && (
                    <div className="flex items-center gap-2 mb-4 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                      <span className="text-cyan-400 text-sm">
                        {selectedPlayer.nickname
                          ? `${selectedPlayer.Name} (${selectedPlayer.nickname})`
                          : selectedPlayer.Name}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedPlayer(null);
                          setSearchQuery("");
                        }}
                        className="ml-auto text-white/40 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Earned At Date */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Earned At *
                    </label>
                    <input
                      type="date"
                      value={earnedAt}
                      onChange={(e) => setEarnedAt(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Description (optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g., Q1 2025 Tournament Winner"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 resize-none"
                      rows={2}
                    />
                    <p className="text-white/40 text-xs mt-1">
                      This will be displayed when viewing the badge details.
                    </p>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleAssignBadge}
                      disabled={!selectedPlayer || isSubmitting}
                      className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg transition-colors"
                    >
                      {isSubmitting ? "Assigning..." : "Assign Badge"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAssignForm(false);
                        resetAssignForm();
                      }}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
