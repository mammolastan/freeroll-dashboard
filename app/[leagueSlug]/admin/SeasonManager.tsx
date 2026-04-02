"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  X,
  Check,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CompetitionPeriod {
  id: number;
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  display_order: number;
}

interface SeasonManagerProps {
  leagueId: number;
  leagueSlug: string;
}

export default function SeasonManager({
  leagueId,
  leagueSlug,
}: SeasonManagerProps) {
  const [periods, setPeriods] = useState<CompetitionPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [periodTypes, setPeriodTypes] = useState<string[]>([
    "monthly",
    "quarterly",
  ]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<CompetitionPeriod | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    period_type: "monthly",
    start_date: "",
    end_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeValue, setNewTypeValue] = useState("");

  // Fetch periods
  const fetchPeriods = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/competition-periods?league=${leagueSlug}&active_only=false`,
      );
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setPeriods(data.periods || []);
    } catch (error) {
      console.error("Error fetching periods:", error);
    } finally {
      setLoading(false);
    }
  }, [leagueSlug]);

  // Fetch period types
  const fetchPeriodTypes = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/competition-periods/types?league=${leagueSlug}`,
      );
      if (!response.ok) throw new Error("Failed to fetch types");
      const data = await response.json();
      setPeriodTypes(data.types || ["monthly", "quarterly"]);
    } catch (error) {
      console.error("Error fetching period types:", error);
    }
  }, [leagueSlug]);

  useEffect(() => {
    fetchPeriods();
    fetchPeriodTypes();
  }, [fetchPeriods, fetchPeriodTypes]);

  // Toggle active status
  const toggleActive = async (period: CompetitionPeriod) => {
    const newActiveState = !period.is_active;

    // Optimistic update
    setPeriods((prev) =>
      prev.map((p) =>
        p.id === period.id ? { ...p, is_active: newActiveState } : p,
      ),
    );

    try {
      const response = await fetch(`/api/competition-periods/${period.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActiveState }),
      });

      if (!response.ok) {
        // Revert on error
        setPeriods((prev) =>
          prev.map((p) =>
            p.id === period.id ? { ...p, is_active: !newActiveState } : p,
          ),
        );
      }
    } catch (error) {
      console.error("Error toggling active:", error);
      // Revert on error
      setPeriods((prev) =>
        prev.map((p) =>
          p.id === period.id ? { ...p, is_active: !newActiveState } : p,
        ),
      );
    }
  };

  // Quick fill helpers
  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    return {
      name: `${monthNames[month]} ${year}`,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
    };
  };

  const getCurrentQuarterRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3);
    const startMonth = quarter * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);

    return {
      name: `Q${quarter + 1} ${year}`,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
    };
  };

  const prefillMonth = () => {
    const range = getCurrentMonthRange();
    setFormData({
      ...formData,
      ...range,
      period_type: "monthly",
    });
  };

  const prefillQuarter = () => {
    const range = getCurrentQuarterRange();
    setFormData({
      ...formData,
      ...range,
      period_type: "quarterly",
    });
  };

  // Create period
  const createPeriod = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      alert("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/competition-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId,
          name: formData.name,
          period_type: formData.period_type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          is_active: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to create");

      const newPeriod = await response.json();
      setPeriods((prev) => [newPeriod, ...prev]);
      setShowCreateModal(false);
      resetForm();
      fetchPeriodTypes(); // Refresh types in case a new one was added
    } catch (error) {
      console.error("Error creating period:", error);
      alert("Failed to create season");
    } finally {
      setSaving(false);
    }
  };

  // Update period
  const updatePeriod = async () => {
    if (
      !editingPeriod ||
      !formData.name ||
      !formData.start_date ||
      !formData.end_date
    ) {
      alert("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/competition-periods/${editingPeriod.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            period_type: formData.period_type,
            start_date: formData.start_date,
            end_date: formData.end_date,
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to update");

      const updatedPeriod = await response.json();
      setPeriods((prev) =>
        prev.map((p) =>
          p.id === editingPeriod.id
            ? { ...updatedPeriod, is_active: p.is_active }
            : p,
        ),
      );
      setShowEditModal(false);
      setEditingPeriod(null);
      resetForm();
      fetchPeriodTypes();
    } catch (error) {
      console.error("Error updating period:", error);
      alert("Failed to update season");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      period_type: "monthly",
      start_date: "",
      end_date: "",
    });
    setShowNewTypeInput(false);
    setNewTypeValue("");
  };

  const openEditModal = (period: CompetitionPeriod) => {
    setEditingPeriod(period);
    setFormData({
      name: period.name,
      period_type: period.period_type,
      start_date: period.start_date.split("T")[0],
      end_date: period.end_date.split("T")[0],
    });
    setShowEditModal(true);
  };

  const addNewType = () => {
    if (newTypeValue.trim()) {
      const newType = newTypeValue.trim().toLowerCase();
      if (!periodTypes.includes(newType)) {
        setPeriodTypes((prev) => [...prev, newType]);
      }
      setFormData({ ...formData, period_type: newType });
      setShowNewTypeInput(false);
      setNewTypeValue("");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC", // Prevent timezone shift for date-only values
    });
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - reorder active periods
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = activePeriods.findIndex((p) => p.id === active.id);
    const newIndex = activePeriods.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the array
    const reordered = arrayMove(activePeriods, oldIndex, newIndex);

    // Calculate new display_order values (higher = first in list)
    // Start from 1000 and decrement by 10 for each position
    const updates = reordered.map((period, index) => ({
      id: period.id,
      display_order: 1000 - index * 10,
    }));

    // Optimistic update
    const updatedPeriods = periods.map((p) => {
      const update = updates.find((u) => u.id === p.id);
      return update ? { ...p, display_order: update.display_order } : p;
    });
    setPeriods(updatedPeriods);

    // Save to server
    try {
      const response = await fetch("/api/competition-periods/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        // Revert on error
        fetchPeriods();
      }
    } catch (error) {
      console.error("Error reordering periods:", error);
      fetchPeriods();
    }
  };

  // Separate active and inactive periods
  const activePeriods = periods
    .filter((p) => p.is_active)
    .sort((a, b) => b.display_order - a.display_order);
  const inactivePeriods = periods.filter((p) => !p.is_active);
  inactivePeriods.sort(
    (a, b) =>
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
  );

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <p className="text-white/40">Loading seasons...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Competition Seasons
        </h2>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Season
        </button>
      </div>

      {/* Active Seasons */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
            Active Seasons ({activePeriods.length})
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {activePeriods.length === 0 ? (
            <p className="px-4 py-6 text-white/40 text-center text-sm">
              No active seasons
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activePeriods.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {activePeriods.map((period, index) => (
                  <SortableSeasonRow
                    key={period.id}
                    period={period}
                    index={index}
                    onToggle={() => toggleActive(period)}
                    onEdit={() => openEditModal(period)}
                    formatDate={formatDate}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Inactive Seasons */}
      {inactivePeriods.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setInactiveExpanded(!inactiveExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
              {inactiveExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              Inactive Seasons ({inactivePeriods.length})
            </h3>
          </button>
          {inactiveExpanded && (
            <div className="divide-y divide-white/5 border-t border-white/10">
              {inactivePeriods.map((period, index) => (
                <SeasonRow
                  key={period.id}
                  period={period}
                  index={index}
                  onToggle={() => toggleActive(period)}
                  onEdit={() => openEditModal(period)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <Modal
          title="Create New Season"
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
        >
          <SeasonForm
            formData={formData}
            setFormData={setFormData}
            periodTypes={periodTypes}
            showNewTypeInput={showNewTypeInput}
            setShowNewTypeInput={setShowNewTypeInput}
            newTypeValue={newTypeValue}
            setNewTypeValue={setNewTypeValue}
            addNewType={addNewType}
            prefillMonth={prefillMonth}
            prefillQuarter={prefillQuarter}
            onSubmit={createPeriod}
            onCancel={() => {
              setShowCreateModal(false);
              resetForm();
            }}
            saving={saving}
            submitLabel="Create Season"
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {showEditModal && editingPeriod && (
        <Modal
          title="Edit Season"
          onClose={() => {
            setShowEditModal(false);
            setEditingPeriod(null);
            resetForm();
          }}
        >
          <SeasonForm
            formData={formData}
            setFormData={setFormData}
            periodTypes={periodTypes}
            showNewTypeInput={showNewTypeInput}
            setShowNewTypeInput={setShowNewTypeInput}
            newTypeValue={newTypeValue}
            setNewTypeValue={setNewTypeValue}
            addNewType={addNewType}
            prefillMonth={prefillMonth}
            prefillQuarter={prefillQuarter}
            onSubmit={updatePeriod}
            onCancel={() => {
              setShowEditModal(false);
              setEditingPeriod(null);
              resetForm();
            }}
            saving={saving}
            submitLabel="Save Changes"
          />
        </Modal>
      )}
    </div>
  );
}

// Sortable Season Row Component (for active seasons with drag-drop)
function SortableSeasonRow({
  period,
  index,
  onToggle,
  onEdit,
  formatDate,
}: {
  period: CompetitionPeriod;
  index: number;
  onToggle: () => void;
  onEdit: () => void;
  formatDate: (date: string) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: period.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rowBg = isDragging
    ? "bg-white/10 opacity-80"
    : index % 2 === 0
      ? "bg-white/[0.02]"
      : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-4 py-3 flex items-center justify-between gap-4 ${rowBg}`}
    >
      <button
        className="p-1 text-white/30 hover:text-white/60 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium truncate">{period.name}</span>
          <span className="px-2 py-0.5 bg-white/10 text-white/60 text-xs rounded">
            {period.period_type}
          </span>
        </div>
        <p className="text-white/40 text-sm mt-0.5">
          {formatDate(period.start_date)} – {formatDate(period.end_date)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onEdit}
          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Edit season"
        >
          <Pencil size={16} />
        </button>
        <ToggleSwitch checked={period.is_active} onChange={onToggle} />
      </div>
    </div>
  );
}

// Season Row Component (for inactive seasons, no drag)
function SeasonRow({
  period,
  index,
  onToggle,
  onEdit,
  formatDate,
}: {
  period: CompetitionPeriod;
  index: number;
  onToggle: () => void;
  onEdit: () => void;
  formatDate: (date: string) => string;
}) {
  const rowBg = index % 2 === 0 ? "bg-white/[0.02]" : "";

  return (
    <div className={`px-4 py-3 flex items-center justify-between gap-4 ${rowBg}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium truncate">{period.name}</span>
          <span className="px-2 py-0.5 bg-white/10 text-white/60 text-xs rounded">
            {period.period_type}
          </span>
        </div>
        <p className="text-white/40 text-sm mt-0.5">
          {formatDate(period.start_date)} – {formatDate(period.end_date)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onEdit}
          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Edit season"
        >
          <Pencil size={16} />
        </button>
        <ToggleSwitch checked={period.is_active} onChange={onToggle} />
      </div>
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors ${
        checked ? "bg-cyan-600" : "bg-white/20"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Modal Component
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Season Form Component
function SeasonForm({
  formData,
  setFormData,
  periodTypes,
  showNewTypeInput,
  setShowNewTypeInput,
  newTypeValue,
  setNewTypeValue,
  addNewType,
  prefillMonth,
  prefillQuarter,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  formData: {
    name: string;
    period_type: string;
    start_date: string;
    end_date: string;
  };
  setFormData: (data: typeof formData) => void;
  periodTypes: string[];
  showNewTypeInput: boolean;
  setShowNewTypeInput: (show: boolean) => void;
  newTypeValue: string;
  setNewTypeValue: (val: string) => void;
  addNewType: () => void;
  prefillMonth: () => void;
  prefillQuarter: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      {/* Quick fill buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={prefillMonth}
          className="flex-1 px-3 py-2 bg-cyan-900/50 hover:bg-cyan-800/50 text-cyan-300 rounded text-sm transition-colors"
        >
          Current Month
        </button>
        <button
          type="button"
          onClick={prefillQuarter}
          className="flex-1 px-3 py-2 bg-emerald-900/50 hover:bg-emerald-800/50 text-emerald-300 rounded text-sm transition-colors"
        >
          Current Quarter
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          Season Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
          placeholder="e.g., January 2026 or Q1 2026"
        />
      </div>

      {/* Period Type */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          Period Type *
        </label>
        {showNewTypeInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTypeValue}
              onChange={(e) => setNewTypeValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNewType()}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
              placeholder="Enter new type..."
              autoFocus
            />
            <button
              type="button"
              onClick={addNewType}
              className="p-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <Check size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewTypeInput(false);
                setNewTypeValue("");
              }}
              className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={formData.period_type}
              onChange={(e) =>
                setFormData({ ...formData, period_type: e.target.value })
              }
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              {periodTypes.map((type) => (
                <option
                  key={type}
                  value={type}
                  className="bg-zinc-900"
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewTypeInput(true)}
              className="px-3 py-2 bg-white/10 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors text-sm"
            >
              + New
            </button>
          </div>
        )}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Start Date *
          </label>
          <input
            type="date"
            value={formData.start_date}
            onChange={(e) =>
              setFormData({ ...formData, start_date: e.target.value })
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            End Date *
          </label>
          <input
            type="date"
            value={formData.end_date}
            onChange={(e) =>
              setFormData({ ...formData, end_date: e.target.value })
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
