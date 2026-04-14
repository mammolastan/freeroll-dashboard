// app/[leagueSlug]/admin/venues/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Plus,
  Trash2,
  X,
  Check,
  MapPin,
  Clock,
  Calendar,
} from "lucide-react";

const RichTextEditor = dynamic(
  () => import("@/components/ui/RichTextEditor"),
  { ssr: false }
);

interface Venue {
  id: number;
  name: string;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  cutoffTime: number | null;
  gameCount: number;
  lastGameDate: string | null;
}

export default function VenuesAdminPage() {
  const { leagueSlug } = useParams();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    notes: "",
    cutoffTime: "",
    isActive: true,
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

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch(`/api/${leagueSlug}/venues`);
      if (!res.ok) throw new Error("Failed to fetch venues");
      const data = await res.json();
      setVenues(data.venues);
    } catch (error) {
      console.error("Error fetching venues:", error);
      showToast("Failed to load venues", "error");
    } finally {
      setLoading(false);
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      notes: "",
      cutoffTime: "",
      isActive: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingVenue(null);
    setModalOpen(true);
  };

  const openEditModal = (venue: Venue) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name,
      address: venue.address || "",
      notes: venue.notes || "",
      cutoffTime: venue.cutoffTime?.toString() || "",
      isActive: venue.isActive,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingVenue(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("Venue name is required", "error");
      return;
    }

    setSaving(true);
    const url = editingVenue
      ? `/api/${leagueSlug}/venues/${editingVenue.id}`
      : `/api/${leagueSlug}/venues`;
    const method = editingVenue ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          notes: formData.notes || null,
          cutoffTime: formData.cutoffTime || null,
          isActive: formData.isActive,
        }),
      });

      if (res.ok) {
        closeModal();
        fetchVenues();
        showToast(editingVenue ? "Venue updated" : "Venue created", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save venue", "error");
      }
    } catch (error) {
      console.error("Error saving venue:", error);
      showToast("Failed to save venue", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (venue: Venue) => {
    try {
      const res = await fetch(`/api/${leagueSlug}/venues/${venue.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchVenues();
        showToast("Venue deleted", "success");
        setDeleteConfirm(null);
      } else {
        const err = await res.json();
        if (res.status === 409) {
          // Show the error and offer to mark inactive
          const confirmInactive = confirm(
            `${err.error}\n\nWould you like to mark this venue as inactive instead?`,
          );
          if (confirmInactive) {
            handleToggleActive(venue);
          }
        } else {
          showToast(err.error || "Failed to delete venue", "error");
        }
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting venue:", error);
      showToast("Failed to delete venue", "error");
      setDeleteConfirm(null);
    }
  };

  const handleToggleActive = async (venue: Venue) => {
    // Optimistic update
    setVenues((prev) =>
      prev.map((v) =>
        v.id === venue.id ? { ...v, isActive: !v.isActive } : v,
      ),
    );

    try {
      const res = await fetch(`/api/${leagueSlug}/venues/${venue.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !venue.isActive }),
      });

      if (!res.ok) {
        // Revert on error
        setVenues((prev) =>
          prev.map((v) =>
            v.id === venue.id ? { ...v, isActive: venue.isActive } : v,
          ),
        );
        const err = await res.json();
        showToast(err.error || "Failed to update venue", "error");
      } else {
        showToast(
          venue.isActive ? "Venue marked inactive" : "Venue marked active",
          "success",
        );
      }
    } catch (error) {
      console.error("Error updating venue:", error);
      // Revert on error
      setVenues((prev) =>
        prev.map((v) =>
          v.id === venue.id ? { ...v, isActive: venue.isActive } : v,
        ),
      );
      showToast("Failed to update venue", "error");
    }
  };

  // Separate active and inactive venues
  const activeVenues = venues.filter((v) => v.isActive);
  const inactiveVenues = venues.filter((v) => !v.isActive);

  if (loading) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-bold text-white mb-1">Venues</h2>
        <p className="text-white/40 text-sm mb-8">
          Manage venues for this league
        </p>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">Loading venues...</p>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Venues</h2>
          <p className="text-white/40 text-sm">
            Manage venues for this league
            <br></br>
            Active venues will be available when creating a new tournament.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Venue
        </button>
      </div>

      {/* Active Venues */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
            Active Venues ({activeVenues.length})
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {activeVenues.length === 0 ? (
            <p className="px-4 py-6 text-white/40 text-center text-sm">
              No active venues
            </p>
          ) : (
            activeVenues.map((venue, index) => (
              <VenueRow
                key={venue.id}
                venue={venue}
                index={index}
                onEdit={() => openEditModal(venue)}
                onToggleActive={() => handleToggleActive(venue)}
                onDelete={() => setDeleteConfirm(venue.id)}
                deleteConfirm={deleteConfirm === venue.id}
                onConfirmDelete={() => handleDelete(venue)}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            ))
          )}
        </div>
      </div>

      {/* Inactive Venues */}
      {inactiveVenues.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden opacity-70">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">
              Inactive Venues ({inactiveVenues.length})
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {inactiveVenues.map((venue, index) => (
              <VenueRow
                key={venue.id}
                venue={venue}
                index={index}
                onEdit={() => openEditModal(venue)}
                onToggleActive={() => handleToggleActive(venue)}
                onDelete={() => setDeleteConfirm(venue.id)}
                deleteConfirm={deleteConfirm === venue.id}
                onConfirmDelete={() => handleDelete(venue)}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {editingVenue ? "Edit Venue" : "Add Venue"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Venue Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g., Limerick Junction"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                  placeholder="Street address (optional)"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Notes
                </label>
                <RichTextEditor
                  content={formData.notes}
                  onChange={(html) => setFormData({ ...formData, notes: html })}
                  placeholder="Add venue notes (parking info, contact details, etc.)"
                />
              </div>

              {/* Cutoff Time */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Check-in Cutoff (minutes after start)
                </label>
                <input
                  type="number"
                  value={formData.cutoffTime}
                  onChange={(e) =>
                    setFormData({ ...formData, cutoffTime: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g., 30"
                  min="0"
                />
                <p className="text-white/40 text-xs mt-1">
                  Leave blank for no cutoff. Players can check in until this
                  many minutes after the tournament starts.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white/70">
                  Active
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, isActive: !formData.isActive })
                  }
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    formData.isActive ? "bg-cyan-600" : "bg-white/20"
                  }`}
                  role="switch"
                  aria-checked={formData.isActive}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      formData.isActive ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                >
                  {saving
                    ? "Saving..."
                    : editingVenue
                      ? "Save Changes"
                      : "Add Venue"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Venue Row Component
function VenueRow({
  venue,
  index,
  onEdit,
  onToggleActive,
  onDelete,
  deleteConfirm,
  onConfirmDelete,
  onCancelDelete,
}: {
  venue: Venue;
  index: number;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  deleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const rowBg = index % 2 === 0 ? "bg-white/[0.02]" : "";

  return (
    <div
      onClick={onEdit}
      className={`px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors ${rowBg}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <MapPin
            size={16}
            className="text-white/40 flex-shrink-0"
          />
          <span className="text-white font-medium truncate">{venue.name}</span>
          {!venue.isActive && (
            <span className="px-2 py-0.5 bg-white/10 text-white/50 text-xs rounded">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-white/40 text-sm flex-wrap">
          {/* Game stats */}
          <span className="flex items-center gap-1 flex-shrink-0">
            {venue.gameCount} {venue.gameCount === 1 ? "game" : "games"}
          </span>
          <span className="flex items-center gap-1 flex-shrink-0">
            <Calendar size={12} />
            {venue.lastGameDate
              ? `Last: ${formatDate(venue.lastGameDate)}`
              : "No games yet"}
          </span>
          {venue.cutoffTime && (
            <span className="flex items-center gap-1 flex-shrink-0">
              <Clock size={12} />
              {venue.cutoffTime}min cutoff
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {deleteConfirm ? (
          <>
            <span className="text-red-400 text-sm mr-2">Delete?</span>
            <button
              onClick={onConfirmDelete}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
              title="Confirm delete"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancelDelete}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            {venue.gameCount === 0 && (
              <button
                onClick={onDelete}
                className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Delete venue"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={onToggleActive}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                venue.isActive ? "bg-cyan-600" : "bg-white/20"
              }`}
              role="switch"
              aria-checked={venue.isActive}
              title={venue.isActive ? "Mark inactive" : "Mark active"}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  venue.isActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
