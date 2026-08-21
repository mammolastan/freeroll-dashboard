// app/l/[leagueSlug]/admin/featured/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Plus,
  Trash2,
  X,
  Check,
  Image as ImageIcon,
  Monitor,
  Users,
  Upload,
  Link,
  Loader2,
  Timer,
  Award,
} from "lucide-react";

interface Ad {
  id: number;
  imageUrl: string;
  title: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface TVScreenSettings {
  slideRotationSeconds: number;
  featuredModules: {
    otherActiveGames: boolean;
    recentBadges: boolean;
  };
  // Backwards compatibility
  tdChatRotationSeconds?: number;
  featuredRotationSeconds?: number;
}

export default function FeaturedAdminPage() {
  const { leagueSlug } = useParams();
  const [ads, setAds] = useState<Ad[]>([]);
  const [tvSettings, setTvSettings] = useState<TVScreenSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload");

  // Form state
  const [formData, setFormData] = useState({
    imageUrl: "",
    title: "",
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

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
    if (!allowedTypes.includes(file.type)) {
      showToast("Invalid file type. Use JPG, PNG, GIF, or WebP.", "error");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast("File too large. Maximum size is 10MB.", "error");
      return;
    }

    setUploading(true);

    try {
      const uploadData = new FormData();
      uploadData.append("image", file);

      const res = await fetch(`/api/${leagueSlug}/admin/ads/upload`, {
        method: "POST",
        body: uploadData,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData({ ...formData, imageUrl: data.imageUrl });
        showToast("Image uploaded", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to upload image", "error");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      showToast("Failed to upload image", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch(`/api/${leagueSlug}/admin/ads`);
      if (!res.ok) throw new Error("Failed to fetch ads");
      const data = await res.json();
      setAds(data.ads);
    } catch (error) {
      console.error("Error fetching ads:", error);
      showToast("Failed to load ads", "error");
    }
  }, [leagueSlug]);

  const fetchTvSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/${leagueSlug}/admin/config`);
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      const settings = data.config.tvScreenSettings;
      // Handle backwards compatibility
      const slideRotation = settings?.slideRotationSeconds
        ?? settings?.tdChatRotationSeconds
        ?? settings?.featuredRotationSeconds
        ?? 15;
      setTvSettings({
        ...settings,
        slideRotationSeconds: slideRotation,
      });
    } catch (error) {
      console.error("Error fetching TV settings:", error);
    }
  }, [leagueSlug]);

  useEffect(() => {
    Promise.all([fetchAds(), fetchTvSettings()]).finally(() =>
      setLoading(false)
    );
  }, [fetchAds, fetchTvSettings]);

  const resetForm = () => {
    setFormData({
      imageUrl: "",
      title: "",
      isActive: true,
    });
    setImageInputMode("upload");
  };

  const openCreateModal = () => {
    resetForm();
    setEditingAd(null);
    setModalOpen(true);
  };

  const openEditModal = (ad: Ad) => {
    setEditingAd(ad);
    setFormData({
      imageUrl: ad.imageUrl,
      title: ad.title || "",
      isActive: ad.isActive,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAd(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!formData.imageUrl.trim()) {
      showToast("Image URL is required", "error");
      return;
    }

    setSaving(true);
    const url = editingAd
      ? `/api/${leagueSlug}/admin/ads/${editingAd.id}`
      : `/api/${leagueSlug}/admin/ads`;
    const method = editingAd ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: formData.imageUrl.trim(),
          title: formData.title.trim() || null,
          isActive: formData.isActive,
        }),
      });

      if (res.ok) {
        closeModal();
        fetchAds();
        showToast(editingAd ? "Ad updated" : "Ad created", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save ad", "error");
      }
    } catch (error) {
      console.error("Error saving ad:", error);
      showToast("Failed to save ad", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ad: Ad) => {
    try {
      const res = await fetch(`/api/${leagueSlug}/admin/ads/${ad.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchAds();
        showToast("Ad deleted", "success");
        setDeleteConfirm(null);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to delete ad", "error");
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting ad:", error);
      showToast("Failed to delete ad", "error");
      setDeleteConfirm(null);
    }
  };

  const handleToggleActive = async (ad: Ad) => {
    // Optimistic update
    setAds((prev) =>
      prev.map((a) => (a.id === ad.id ? { ...a, isActive: !a.isActive } : a))
    );

    try {
      const res = await fetch(`/api/${leagueSlug}/admin/ads/${ad.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !ad.isActive }),
      });

      if (!res.ok) {
        // Revert on error
        setAds((prev) =>
          prev.map((a) =>
            a.id === ad.id ? { ...a, isActive: ad.isActive } : a
          )
        );
        const err = await res.json();
        showToast(err.error || "Failed to update ad", "error");
      } else {
        showToast(
          ad.isActive ? "Ad disabled" : "Ad enabled",
          "success"
        );
      }
    } catch (error) {
      console.error("Error updating ad:", error);
      setAds((prev) =>
        prev.map((a) => (a.id === ad.id ? { ...a, isActive: ad.isActive } : a))
      );
      showToast("Failed to update ad", "error");
    }
  };

  const handleToggleFeaturedModule = async (
    module: keyof TVScreenSettings["featuredModules"]
  ) => {
    if (!tvSettings) return;

    const newValue = !tvSettings.featuredModules[module];

    // Optimistic update
    setTvSettings((prev) =>
      prev
        ? {
            ...prev,
            featuredModules: {
              ...prev.featuredModules,
              [module]: newValue,
            },
          }
        : null
    );

    try {
      const res = await fetch(`/api/${leagueSlug}/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tvScreenSettings: {
            featuredModules: {
              [module]: newValue,
            },
          },
        }),
      });

      if (!res.ok) {
        // Revert on error
        setTvSettings((prev) =>
          prev
            ? {
                ...prev,
                featuredModules: {
                  ...prev.featuredModules,
                  [module]: !newValue,
                },
              }
            : null
        );
        showToast("Failed to update setting", "error");
      } else {
        showToast(
          `Other Active Games ${newValue ? "enabled" : "disabled"}`,
          "success"
        );
      }
    } catch (error) {
      console.error("Error updating featured module:", error);
      setTvSettings((prev) =>
        prev
          ? {
              ...prev,
              featuredModules: {
                ...prev.featuredModules,
                [module]: !newValue,
              },
            }
          : null
      );
      showToast("Failed to update setting", "error");
    }
  };

  const handleUpdateRotationSeconds = async (seconds: number) => {
    if (!tvSettings) return;

    const oldValue = tvSettings.slideRotationSeconds;

    // Optimistic update
    setTvSettings((prev) =>
      prev ? { ...prev, slideRotationSeconds: seconds } : null
    );

    try {
      const res = await fetch(`/api/${leagueSlug}/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tvScreenSettings: {
            slideRotationSeconds: seconds,
          },
        }),
      });

      if (!res.ok) {
        // Revert on error
        setTvSettings((prev) =>
          prev ? { ...prev, slideRotationSeconds: oldValue } : null
        );
        showToast("Failed to update setting", "error");
      } else {
        showToast(`Slide duration set to ${seconds} seconds`, "success");
      }
    } catch (error) {
      console.error("Error updating rotation seconds:", error);
      setTvSettings((prev) =>
        prev ? { ...prev, slideRotationSeconds: oldValue } : null
      );
      showToast("Failed to update setting", "error");
    }
  };

  // Separate active and inactive ads
  const activeAds = ads.filter((a) => a.isActive);
  const inactiveAds = ads.filter((a) => !a.isActive);

  if (loading) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-bold text-white mb-1">Featured Content</h2>
        <p className="text-white/40 text-sm mb-8">
          Manage ads and featured modules for TV screens
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">Loading...</p>
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
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-1">Featured Content</h2>
        <p className="text-white/40 text-sm">
          Manage ads and featured modules for TV screens
        </p>
      </div>

      {/* Featured Modules Section */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider flex items-center gap-2">
            <Monitor size={16} />
            Featured Modules (League Defaults)
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-white/50 text-sm">
            These settings control which modules appear by default on TV screens.
            TDs can override these settings for individual games.
          </p>

          {/* Slide Rotation Duration */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3">
              <Timer size={18} className="text-cyan-400" />
              <div>
                <p className="text-white font-medium">Slide Duration</p>
                <p className="text-white/40 text-sm">
                  How long each slide stays visible before switching
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={tvSettings?.slideRotationSeconds ?? 15}
                onChange={(e) => handleUpdateRotationSeconds(parseInt(e.target.value))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="5">5 sec</option>
                <option value="10">10 sec</option>
                <option value="15">15 sec</option>
                <option value="20">20 sec</option>
                <option value="30">30 sec</option>
                <option value="45">45 sec</option>
                <option value="60">60 sec</option>
              </select>
            </div>
          </div>

          {/* Other Active Games Toggle */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3">
              <Users size={18} className="text-emerald-400" />
              <div>
                <p className="text-white font-medium">Other Active Games</p>
                <p className="text-white/40 text-sm">
                  Show stats from other tournaments happening in your league
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleFeaturedModule("otherActiveGames")}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                tvSettings?.featuredModules.otherActiveGames
                  ? "bg-emerald-600"
                  : "bg-white/20"
              }`}
              role="switch"
              aria-checked={tvSettings?.featuredModules.otherActiveGames}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  tvSettings?.featuredModules.otherActiveGames
                    ? "translate-x-4"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Recent Badges Toggle */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3">
              <Award size={18} className="text-purple-400" />
              <div>
                <p className="text-white font-medium">Recent Badges</p>
                <p className="text-white/40 text-sm">
                  Celebrate the 5 most recent badge winners in your league
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleFeaturedModule("recentBadges")}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                tvSettings?.featuredModules.recentBadges
                  ? "bg-emerald-600"
                  : "bg-white/20"
              }`}
              role="switch"
              aria-checked={tvSettings?.featuredModules.recentBadges}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  tvSettings?.featuredModules.recentBadges
                    ? "translate-x-4"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Ads Section */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ImageIcon size={18} />
          Ads
        </h3>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Ad
        </button>
      </div>

      {/* Active Ads */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
            Active Ads ({activeAds.length})
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {activeAds.length === 0 ? (
            <p className="px-4 py-6 text-white/40 text-center text-sm">
              No active ads. Add your first ad to display on TV screens.
            </p>
          ) : (
            activeAds.map((ad, index) => (
              <AdRow
                key={ad.id}
                ad={ad}
                index={index}
                onEdit={() => openEditModal(ad)}
                onToggleActive={() => handleToggleActive(ad)}
                onDelete={() => setDeleteConfirm(ad.id)}
                deleteConfirm={deleteConfirm === ad.id}
                onConfirmDelete={() => handleDelete(ad)}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            ))
          )}
        </div>
      </div>

      {/* Inactive Ads */}
      {inactiveAds.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden opacity-70">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">
              Inactive Ads ({inactiveAds.length})
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {inactiveAds.map((ad, index) => (
              <AdRow
                key={ad.id}
                ad={ad}
                index={index}
                onEdit={() => openEditModal(ad)}
                onToggleActive={() => handleToggleActive(ad)}
                onDelete={() => setDeleteConfirm(ad.id)}
                deleteConfirm={deleteConfirm === ad.id}
                onConfirmDelete={() => handleDelete(ad)}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">
                {editingAd ? "Edit Ad" : "Add Ad"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Image Input Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Image *
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setImageInputMode("upload")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      imageInputMode === "upload"
                        ? "bg-emerald-600 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <Upload size={16} />
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode("url")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      imageInputMode === "url"
                        ? "bg-emerald-600 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <Link size={16} />
                    URL
                  </button>
                </div>

                {/* Upload Mode */}
                {imageInputMode === "upload" && (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      uploading
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-white/20 hover:border-white/40"
                    }`}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={24} className="text-emerald-400 animate-spin" />
                        <p className="text-white/60 text-sm">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto text-white/40 mb-2" />
                        <p className="text-white/60 text-sm mb-2">
                          Drag & drop an image here, or
                        </p>
                        <label className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg cursor-pointer transition-colors">
                          Browse Files
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file);
                            }}
                          />
                        </label>
                        <p className="text-white/40 text-xs mt-3">
                          JPG, PNG, GIF, or WebP. Max 10MB.
                          <br />
                          Recommended: 640x800px (portrait 4:5)
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* URL Mode */}
                {imageInputMode === "url" && (
                  <>
                    <input
                      type="text"
                      value={formData.imageUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, imageUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                      placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-white/40 text-xs mt-1">
                      Direct link to an image file. Recommended: 640x800px (portrait 4:5)
                    </p>
                  </>
                )}
              </div>

              {/* Image Preview */}
              {formData.imageUrl && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-40 object-contain bg-black/50"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {imageInputMode === "upload" && (
                    <div className="px-3 py-2 bg-white/5 border-t border-white/10">
                      <p className="text-white/40 text-xs truncate">{formData.imageUrl}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g., Sponsor Name"
                />
                <p className="text-white/40 text-xs mt-1">
                  For your reference only, not displayed on TV
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
                    formData.isActive ? "bg-emerald-600" : "bg-white/20"
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
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {saving
                    ? "Saving..."
                    : editingAd
                      ? "Save Changes"
                      : "Add Ad"}
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

// Ad Row Component
function AdRow({
  ad,
  index,
  onEdit,
  onToggleActive,
  onDelete,
  deleteConfirm,
  onConfirmDelete,
  onCancelDelete,
}: {
  ad: Ad;
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
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Thumbnail */}
        <div className="w-16 h-10 bg-black/50 rounded overflow-hidden flex-shrink-0">
          <img
            src={ad.imageUrl}
            alt={ad.title || "Ad"}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium truncate">
              {ad.title || "Untitled Ad"}
            </span>
            {!ad.isActive && (
              <span className="px-2 py-0.5 bg-white/10 text-white/50 text-xs rounded">
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
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
            <button
              onClick={onDelete}
              className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="Delete ad"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onToggleActive}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                ad.isActive ? "bg-emerald-600" : "bg-white/20"
              }`}
              role="switch"
              aria-checked={ad.isActive}
              title={ad.isActive ? "Disable ad" : "Enable ad"}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  ad.isActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
