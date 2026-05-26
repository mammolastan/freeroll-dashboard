// app/[leagueSlug]/admin/members/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Search,
  Plus,
  X,
  User,
  Mail,
  CheckCircle,
  XCircle,
  Camera,
  Shield,
  Calendar,
  Trophy,
  Target,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Player {
  id: number;
  uid: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  photoUrl: string | null;
  favoriteHand: string | null;
  favoritePro: string | null;
  isAdmin: boolean;
  isClaimed: boolean;
  hasPhoto: boolean;
  created: string;
  modified: string;
  gameCount: number;
  totalPoints: number;
  knockoutCount?: number;
  lastGameDate: string | null;
  firstGameDate?: string | null;
  bestPlacement?: number | null;
}

export default function MembersPage() {
  const { leagueSlug } = useParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "recent" | "games" | "created" | "claimed" | "photo"
  >("recent");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [claimedFilter, setClaimedFilter] = useState<
    "all" | "claimed" | "unclaimed"
  >("all");
  const [photoFilter, setPhotoFilter] = useState<"all" | "with" | "without">(
    "all",
  );
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 25;

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    email: "",
    favoriteHand: "",
    favoritePro: "",
    isAdmin: false,
  });

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      }
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      if (claimedFilter !== "all") params.set("claimed", claimedFilter);
      if (photoFilter !== "all") params.set("photo", photoFilter);

      const res = await fetch(
        `/api/${leagueSlug}/admin/players?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch players");
      const data = await res.json();
      setPlayers(data.players);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching players:", error);
      showToast("Failed to load players", "error");
    } finally {
      setLoading(false);
    }
  }, [
    leagueSlug,
    debouncedSearch,
    offset,
    sortBy,
    sortDir,
    claimedFilter,
    photoFilter,
  ]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const fetchPlayerDetail = async (uid: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/${leagueSlug}/admin/players/${uid}`);
      if (!res.ok) throw new Error("Failed to fetch player details");
      const data = await res.json();
      setDetailPlayer(data.player);
    } catch (error) {
      console.error("Error fetching player detail:", error);
      showToast("Failed to load player details", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      nickname: "",
      email: "",
      favoriteHand: "",
      favoritePro: "",
      isAdmin: false,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingPlayer(null);
    setDetailPlayer(null);
    setModalOpen(true);
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    setDetailPlayer(null);
    setFormData({
      firstName: player.firstName || "",
      lastName: player.lastName || "",
      nickname: player.nickname || "",
      email: player.email || "",
      favoriteHand: player.favoriteHand || "",
      favoritePro: player.favoritePro || "",
      isAdmin: player.isAdmin,
    });
    setModalOpen(true);
    fetchPlayerDetail(player.uid);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPlayer(null);
    setDetailPlayer(null);
    resetForm();
  };

  const handleSave = async () => {
    if (
      !formData.firstName.trim() &&
      !formData.lastName.trim() &&
      !formData.nickname.trim()
    ) {
      showToast(
        "At least a first name, last name, or nickname is required",
        "error",
      );
      return;
    }

    setSaving(true);
    const url = editingPlayer
      ? `/api/${leagueSlug}/admin/players/${editingPlayer.uid}`
      : `/api/${leagueSlug}/admin/players`;
    const method = editingPlayer ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName.trim() || null,
          lastName: formData.lastName.trim() || null,
          nickname: formData.nickname.trim() || null,
          email: formData.email.trim() || null,
          favoriteHand: formData.favoriteHand.trim() || null,
          favoritePro: formData.favoritePro.trim() || null,
          isAdmin: formData.isAdmin,
        }),
      });

      if (res.ok) {
        closeModal();
        fetchPlayers();
        showToast(
          editingPlayer ? "Player updated" : "Player created",
          "success",
        );
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save player", "error");
      }
    } catch (error) {
      console.error("Error saving player:", error);
      showToast("Failed to save player", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (player: Player) => {
    try {
      const res = await fetch(
        `/api/${leagueSlug}/admin/players/${player.uid}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        fetchPlayers();
        showToast("Player deleted", "success");
        setDeleteConfirm(null);
        if (modalOpen) closeModal();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to delete player", "error");
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting player:", error);
      showToast("Failed to delete player", "error");
      setDeleteConfirm(null);
    }
  };

  const getDisplayName = (player: Player) => {
    const fullName = [player.firstName, player.lastName]
      .filter(Boolean)
      .join(" ");
    if (fullName && player.nickname) {
      return `${fullName} (${player.nickname})`;
    }
    return fullName || player.nickname || "Unknown";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-4xl">
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Members</h2>
          <p className="text-white/40 text-sm">
            Manage player profiles for this league
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Player
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, nickname, email, or exact UID..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Results info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(
              e.target.value as
                | "recent"
                | "games"
                | "created"
                | "claimed"
                | "photo",
            );
            setOffset(0);
          }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
        >
          <option
            value="recent"
            className="bg-zinc-900"
          >
            Sort: Recent activity
          </option>
          <option
            value="games"
            className="bg-zinc-900"
          >
            Sort: Total games played
          </option>
          <option
            value="created"
            className="bg-zinc-900"
          >
            Sort: Created date
          </option>
          <option
            value="claimed"
            className="bg-zinc-900"
          >
            Sort: Is claimed
          </option>
          <option
            value="photo"
            className="bg-zinc-900"
          >
            Sort: Has photo
          </option>
        </select>

        <select
          value={sortDir}
          onChange={(e) => {
            setSortDir(e.target.value as "desc" | "asc");
            setOffset(0);
          }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
        >
          <option
            value="desc"
            className="bg-zinc-900"
          >
            Order: Descending
          </option>
          <option
            value="asc"
            className="bg-zinc-900"
          >
            Order: Ascending
          </option>
        </select>

        <select
          value={claimedFilter}
          onChange={(e) => {
            setClaimedFilter(e.target.value as "all" | "claimed" | "unclaimed");
            setOffset(0);
          }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
        >
          <option
            value="all"
            className="bg-zinc-900"
          >
            Claimed: All
          </option>
          <option
            value="claimed"
            className="bg-zinc-900"
          >
            Claimed only
          </option>
          <option
            value="unclaimed"
            className="bg-zinc-900"
          >
            Unclaimed only
          </option>
        </select>

        <select
          value={photoFilter}
          onChange={(e) => {
            setPhotoFilter(e.target.value as "all" | "with" | "without");
            setOffset(0);
          }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
        >
          <option
            value="all"
            className="bg-zinc-900"
          >
            Photo: All
          </option>
          <option
            value="with"
            className="bg-zinc-900"
          >
            With photo
          </option>
          <option
            value="without"
            className="bg-zinc-900"
          >
            Without photo
          </option>
        </select>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-white/40 text-sm">
          {loading
            ? "Loading..."
            : `Showing ${players.length} of ${total} players`}
        </p>
      </div>

      {/* Players List */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="divide-y divide-white/5">
          {loading && players.length === 0 ? (
            <p className="px-4 py-8 text-white/40 text-center text-sm">
              Loading players...
            </p>
          ) : players.length === 0 ? (
            <p className="px-4 py-8 text-white/40 text-center text-sm">
              {debouncedSearch
                ? "No players found matching your search"
                : "No players in this league yet"}
            </p>
          ) : (
            players.map((player, index) => {
              const rowBg = index % 2 === 0 ? "bg-white/[0.02]" : "";

              return (
                <div
                  key={player.uid}
                  onClick={() => openEditModal(player)}
                  className={`px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors ${rowBg}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {player.photoUrl ? (
                        <img
                          src={player.photoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User
                          size={20}
                          className="text-white/40"
                        />
                      )}
                    </div>

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium truncate">
                          {getDisplayName(player)}
                        </span>
                        {player.isAdmin && (
                          <span title="Admin">
                            <Shield
                              size={14}
                              className="text-amber-400 flex-shrink-0"
                            />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-white/40 text-sm flex-wrap">
                        <span>{player.gameCount} games</span>
                        <span>{player.totalPoints.toLocaleString()} pts</span>
                        {player.lastGameDate && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(player.lastGameDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status indicators */}
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Photo indicator */}
                    <div
                      className={`p-1.5 rounded ${player.hasPhoto ? "text-green-400" : "text-white/20"}`}
                      title={
                        player.hasPhoto
                          ? "Has profile photo"
                          : "No profile photo"
                      }
                    >
                      <Camera size={16} />
                    </div>

                    {/* Claimed indicator */}
                    <div
                      className={`p-1.5 rounded ${player.isClaimed ? "text-cyan-400" : "text-white/20"}`}
                      title={
                        player.isClaimed
                          ? `Claimed: ${player.email}`
                          : "Unclaimed profile"
                      }
                    >
                      {player.isClaimed ? (
                        <CheckCircle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-white/60 text-sm px-4">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {editingPlayer ? "Edit Player" : "Add Player"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Player Stats Summary (when editing) */}
              {editingPlayer && detailPlayer && (
                <div className="bg-white/5 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-4 mb-3">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                      {detailPlayer.photoUrl ? (
                        <img
                          src={detailPlayer.photoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User
                          size={32}
                          className="text-white/40"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {getDisplayName(detailPlayer)}
                      </p>
                      <p className="text-white/40 text-sm">
                        UID: {detailPlayer.uid}
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-white/60">
                      <Trophy
                        size={14}
                        className="text-amber-400"
                      />
                      <span>{detailPlayer.gameCount} games played</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Target
                        size={14}
                        className="text-red-400"
                      />
                      <span>{detailPlayer.knockoutCount || 0} knockouts</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Calendar size={14} />
                      <span>
                        First game:{" "}
                        {formatDate(detailPlayer.firstGameDate || null)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Calendar size={14} />
                      <span>
                        Last game: {formatDate(detailPlayer.lastGameDate)}
                      </span>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        detailPlayer.isClaimed
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-white/10 text-white/40"
                      }`}
                    >
                      {detailPlayer.isClaimed ? (
                        <CheckCircle size={12} />
                      ) : (
                        <XCircle size={12} />
                      )}
                      {detailPlayer.isClaimed ? "Claimed" : "Unclaimed"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        detailPlayer.hasPhoto
                          ? "bg-green-500/20 text-green-400"
                          : "bg-white/10 text-white/40"
                      }`}
                    >
                      <Camera size={12} />
                      {detailPlayer.hasPhoto ? "Has Photo" : "No Photo"}
                    </span>
                    {detailPlayer.emailVerified && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                        <Mail size={12} />
                        Email Verified
                      </span>
                    )}
                  </div>

                  {/* Last login */}
                  {detailPlayer.lastLoginAt && (
                    <p className="text-white/40 text-xs mt-2">
                      Last login: {formatDate(detailPlayer.lastLoginAt)}
                    </p>
                  )}
                </div>
              )}

              {loadingDetail && editingPlayer && (
                <div className="bg-white/5 rounded-lg p-4 mb-4">
                  <p className="text-white/40 text-center">
                    Loading player details...
                  </p>
                </div>
              )}

              <form
                className="contents"
                autoComplete="off"
                onSubmit={(e) => e.preventDefault()}
              >
                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="fr-player-first"
                      autoComplete="off"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="fr-player-last"
                      autoComplete="off"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">
                    Nickname
                  </label>
                  <input
                    type="text"
                    name="fr-player-nickname"
                    autoComplete="off"
                    value={formData.nickname}
                    onChange={(e) =>
                      setFormData({ ...formData, nickname: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                    placeholder="The Shark"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">
                    Email
                  </label>
                  <input
                    type="text"
                    inputMode="email"
                    name="fr-player-email"
                    autoComplete="off"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                    placeholder="player@example.com"
                  />
                  <p className="text-white/40 text-xs mt-1">
                    {editingPlayer
                      ? "Changing email will update the player's login credentials"
                      : "Adding an email allows the player to claim this profile"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Favorite Hand
                    </label>
                    <input
                      type="text"
                      name="fr-player-fav-hand"
                      autoComplete="off"
                      value={formData.favoriteHand}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          favoriteHand: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                      placeholder="A-A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Favorite Pro
                    </label>
                    <input
                      type="text"
                      name="fr-player-fav-pro"
                      autoComplete="off"
                      value={formData.favoritePro}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          favoritePro: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                      placeholder="Phil Ivey"
                    />
                  </div>
                </div>

                {/* Admin Toggle */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <label className="text-sm font-medium text-white/70">
                      League Admin
                    </label>
                    <p className="text-white/40 text-xs">
                      Admins can manage tournaments and players
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, isAdmin: !formData.isAdmin })
                    }
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      formData.isAdmin ? "bg-amber-600" : "bg-white/20"
                    }`}
                    role="switch"
                    aria-checked={formData.isAdmin}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.isAdmin ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                  >
                    {saving
                      ? "Saving..."
                      : editingPlayer
                        ? "Save Changes"
                        : "Add Player"}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {/* Delete section (only for editing) */}
                {editingPlayer && (
                  <div className="pt-4 border-t border-white/10">
                    {deleteConfirm === editingPlayer.uid ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-sm flex-1">
                          Delete this player? This cannot be undone.
                        </span>
                        <button
                          onClick={() => handleDelete(editingPlayer)}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(editingPlayer.uid)}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        <Trash2 size={16} />
                        Delete Player
                      </button>
                    )}
                    <p className="text-white/30 text-xs mt-2">
                      Note: Players with game history cannot be deleted
                    </p>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
