"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { BlindLevel } from "@/lib/blindLevels";

interface ScheduleRow {
  id: number;
  name: string;
  description: string;
  levels: BlindLevel[];
  isSystem: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingSchedule: ScheduleRow | null;   // null = create mode
  systemSchedules: ScheduleRow[];         // for seeding a new schedule
  onSave: (name: string, description: string, levels: BlindLevel[], id?: number) => Promise<void>;
}

export function BlindScheduleAdminModal({ isOpen, onClose, editingSchedule, systemSchedules, onSave }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [levels, setLevels] = useState<BlindLevel[]>([]);
  const [seedId, setSeedId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (editingSchedule) {
      setName(editingSchedule.name);
      setDescription(editingSchedule.description);
      setLevels(JSON.parse(JSON.stringify(editingSchedule.levels)));
      setSeedId(null);
    } else {
      setName("");
      setDescription("");
      // Default seed to Standard Speed (first system schedule)
      const seed = systemSchedules[0] ?? null;
      setSeedId(seed?.id ?? null);
      setLevels(seed ? JSON.parse(JSON.stringify(seed.levels)) : []);
      setError("");
    }
  }, [isOpen, editingSchedule, systemSchedules]);

  // When seed changes (create mode only), reload levels
  const handleSeedChange = (id: number) => {
    setSeedId(id);
    const seed = systemSchedules.find((s) => s.id === id);
    if (seed) setLevels(JSON.parse(JSON.stringify(seed.levels)));
  };

  const handleLevelChange = (index: number, field: keyof BlindLevel, value: number | boolean) => {
    setLevels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteLevel = (index: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, level: i + 1 })));
  };

  const handleAddLevel = () => {
    const last = levels[levels.length - 1];
    setLevels([...levels, {
      level: levels.length + 1,
      duration: last?.duration || 20,
      smallBlind: last ? last.bigBlind : 100,
      bigBlind: last ? last.bigBlind * 2 : 200,
      isbreak: false,
    }]);
  };

  const handleAddBreak = () => {
    setLevels([...levels, {
      level: levels.length + 1,
      duration: 15,
      smallBlind: 0,
      bigBlind: 0,
      isbreak: true,
    }]);
  };

  const handleSave = async () => {
    setError("");
    if (!name.trim()) { setError("Name is required."); return; }
    if (levels.length === 0) { setError("At least one level is required."); return; }
    setIsSaving(true);
    try {
      await onSave(name.trim(), description.trim(), levels, editingSchedule?.id);
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingSchedule ? "Edit Schedule" : "New Schedule"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name + Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Friday Night Special"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 15-min levels, no 300/600"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Seed selector (create mode only) */}
          {!editingSchedule && systemSchedules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start from preset</label>
              <select
                value={seedId ?? ""}
                onChange={(e) => handleSeedChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md text-black"
              >
                {systemSchedules.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Levels are loaded from this preset and can then be customised below.</p>
            </div>
          )}

          {/* Level editor */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration (min)</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Small Blind</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Big Blind</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ante</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {levels.map((level, index) => (
                  <tr key={index} className={level.isbreak ? "bg-blue-50" : ""}>
                    <td className="px-3 py-2 text-sm text-gray-600">{level.level}</td>
                    <td className="px-3 py-2">
                      <select
                        value={level.isbreak ? "break" : "play"}
                        onChange={(e) => handleLevelChange(index, "isbreak", e.target.value === "break")}
                        className="px-2 py-1 border border-gray-300 rounded text-black text-sm"
                      >
                        <option value="play">Play</option>
                        <option value="break">Break</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" value={level.duration}
                        onChange={(e) => handleLevelChange(index, "duration", parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-black text-center text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      {!level.isbreak && (
                        <input type="number" step={50} min="0" value={level.smallBlind}
                          onChange={(e) => handleLevelChange(index, "smallBlind", parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-black text-center text-sm" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!level.isbreak && (
                        <input type="number" step={50} min="0" value={level.bigBlind}
                          onChange={(e) => handleLevelChange(index, "bigBlind", parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-black text-center text-sm" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!level.isbreak && (
                        <input type="number" step={50} min="0" value={level.ante ?? 0}
                          onChange={(e) => handleLevelChange(index, "ante", parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-black text-center text-sm" />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => handleDeleteLevel(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleAddLevel}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
              <Plus size={14} /> Add Level
            </button>
            <button onClick={handleAddBreak}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm">
              <Plus size={14} /> Add Break
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
