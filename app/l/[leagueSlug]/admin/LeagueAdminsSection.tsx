"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Crown, Shield, Trash2, ChevronDown, Search, X } from "lucide-react";

interface Admin {
  id: number;
  playerUid: string;
  role: "owner" | "admin";
  assignedBy: string | null;
  created: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
}

interface PlayerSearchResult {
  UID: string;
  Name: string;
  nickname: string | null;
  TotalGames: number;
}

interface LeagueAdminsSectionProps {
  leagueSlug: string;
  currentUserRole: "owner" | "admin" | null;
  currentUserUid: string;
}

export function LeagueAdminsSection({
  leagueSlug,
  currentUserRole,
  currentUserUid,
}: LeagueAdminsSectionProps) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "owner">("admin");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = currentUserRole === "owner";

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch(`/api/${leagueSlug}/admins`);
      if (!res.ok) throw new Error("Failed to fetch admins");
      const data = await res.json();
      setAdmins(data.admins);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

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
          // Filter out players who are already admins
          const existingUids = new Set(admins.map((a) => a.playerUid));
          const filtered = data.filter(
            (p: PlayerSearchResult) => !existingUids.has(p.UID)
          );
          setSearchResults(filtered);
        }
      } catch {
        // Ignore search errors
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, admins]);

  const handleAddAdmin = async () => {
    if (!selectedPlayer) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/${leagueSlug}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerUid: selectedPlayer.UID,
          role: selectedRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add admin");
      }

      // Reset form and refresh list
      setShowAddForm(false);
      setSearchQuery("");
      setSelectedPlayer(null);
      setSelectedRole("admin");
      await fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (admin: Admin) => {
    if (!confirm(`Remove ${getDisplayName(admin)} as ${admin.role}?`)) return;

    try {
      const res = await fetch(`/api/${leagueSlug}/admins/${admin.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }

      await fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  const handleChangeRole = async (admin: Admin, newRole: "owner" | "admin") => {
    try {
      const res = await fetch(`/api/${leagueSlug}/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }

      await fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const getDisplayName = (admin: Admin) => {
    const fullName = [admin.firstName, admin.lastName].filter(Boolean).join(" ");
    if (admin.nickname && fullName) {
      return `${fullName} (${admin.nickname})`;
    }
    return fullName || admin.nickname || admin.playerUid;
  };

  if (loading) {
    return (
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white mb-4">League Admins</h2>
        <div className="text-white/40">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white mb-4">League Admins</h2>
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  const owners = admins.filter((a) => a.role === "owner");
  const adminList = admins.filter((a) => a.role === "admin");

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">League Admins</h2>
        {canManage && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
          >
            Add Admin
          </button>
        )}
      </div>

      {/* Add Admin Form */}
      {showAddForm && canManage && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">Add New Admin</span>
            <button
              onClick={() => {
                setShowAddForm(false);
                setSearchQuery("");
                setSelectedPlayer(null);
              }}
              className="text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Player Search */}
          <div className="relative mb-3">
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
            <div className="flex items-center gap-2 mb-3 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
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

          {/* Role Selection */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-white/60 text-sm">Role:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRole("admin")}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  selectedRole === "admin"
                    ? "bg-blue-600 text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                <Shield className="w-3 h-3 inline mr-1" />
                Admin
              </button>
              <button
                onClick={() => setSelectedRole("owner")}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  selectedRole === "owner"
                    ? "bg-amber-600 text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                <Crown className="w-3 h-3 inline mr-1" />
                Owner
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleAddAdmin}
            disabled={!selectedPlayer || isSubmitting}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg transition-colors"
          >
            {isSubmitting ? "Adding..." : "Add as " + selectedRole}
          </button>
        </div>
      )}

      {/* Owners List */}
      {owners.length > 0 && (
        <div className="mb-4">
          <div className="text-xs uppercase tracking-widest text-amber-400/60 mb-2 flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Owners
          </div>
          <div className="space-y-2">
            {owners.map((admin) => (
              <AdminRow
                key={admin.id}
                admin={admin}
                canManage={canManage}
                isCurrentUser={admin.playerUid === currentUserUid}
                onRemove={handleRemove}
                onChangeRole={handleChangeRole}
              />
            ))}
          </div>
        </div>
      )}

      {/* Admins List */}
      {adminList.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-blue-400/60 mb-2 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Admins
          </div>
          <div className="space-y-2">
            {adminList.map((admin) => (
              <AdminRow
                key={admin.id}
                admin={admin}
                canManage={canManage}
                isCurrentUser={admin.playerUid === currentUserUid}
                onRemove={handleRemove}
                onChangeRole={handleChangeRole}
              />
            ))}
          </div>
        </div>
      )}

      {admins.length === 0 && (
        <div className="text-white/40 text-sm">No admins configured yet.</div>
      )}
    </div>
  );
}

// Individual Admin Row Component
function AdminRow({
  admin,
  canManage,
  isCurrentUser,
  onRemove,
  onChangeRole,
}: {
  admin: Admin;
  canManage: boolean;
  isCurrentUser: boolean;
  onRemove: (admin: Admin) => void;
  onChangeRole: (admin: Admin, newRole: "owner" | "admin") => void;
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const getDisplayName = () => {
    const fullName = [admin.firstName, admin.lastName].filter(Boolean).join(" ");
    if (admin.nickname && fullName) {
      return `${fullName} (${admin.nickname})`;
    }
    return fullName || admin.nickname || admin.playerUid;
  };

  const roleIcon =
    admin.role === "owner" ? (
      <Crown className="w-4 h-4 text-amber-400" />
    ) : (
      <Shield className="w-4 h-4 text-blue-400" />
    );

  return (
    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        {roleIcon}
        <div>
          <span className="text-white font-medium">{getDisplayName()}</span>
          {isCurrentUser && (
            <span className="ml-2 text-xs text-cyan-400">(you)</span>
          )}
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          {/* Role Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
            >
              {admin.role}
              <ChevronDown className="w-3 h-3" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1 w-32 bg-gray-900 border border-white/10 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    onChangeRole(admin, "owner");
                    setShowRoleMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${
                    admin.role === "owner" ? "text-amber-400" : "text-white"
                  }`}
                >
                  <Crown className="w-3 h-3 inline mr-2" />
                  Owner
                </button>
                <button
                  onClick={() => {
                    onChangeRole(admin, "admin");
                    setShowRoleMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${
                    admin.role === "admin" ? "text-blue-400" : "text-white"
                  }`}
                >
                  <Shield className="w-3 h-3 inline mr-2" />
                  Admin
                </button>
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={() => onRemove(admin)}
            className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
