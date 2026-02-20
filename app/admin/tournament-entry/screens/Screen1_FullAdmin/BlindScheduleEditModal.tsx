// app/admin/tournament-entry/screens/Screen1_FullAdmin/BlindScheduleEditModal.tsx

"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  BlindLevel,
  BLIND_SCHEDULES,
  getBlindSchedule,
} from "@/lib/blindLevels";

interface BlindScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: number;
  currentScheduleId: string;
  customLevels: BlindLevel[] | null;
  onSave: (levels: BlindLevel[]) => Promise<void>;
}

export function BlindScheduleEditModal({
  isOpen,
  onClose,
  currentScheduleId,
  customLevels,
  onSave,
}: BlindScheduleEditModalProps) {
  const [levels, setLevels] = useState<BlindLevel[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize levels when modal opens
  useEffect(() => {
    if (isOpen) {
      // Use custom levels if they exist, otherwise get from preset
      const initialLevels = customLevels || getBlindSchedule(currentScheduleId);
      // Deep clone to avoid mutating original
      setLevels(JSON.parse(JSON.stringify(initialLevels)));
    }
  }, [isOpen, currentScheduleId, customLevels]);

  if (!isOpen) return null;

  const handleLevelChange = (
    index: number,
    field: keyof BlindLevel,
    value: number | boolean,
  ) => {
    setLevels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteLevel = (index: number) => {
    setLevels((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Renumber levels
      return updated.map((level, i) => ({ ...level, level: i + 1 }));
    });
  };

  const handleAddLevel = () => {
    const lastLevel = levels[levels.length - 1];
    const newLevel: BlindLevel = {
      level: levels.length + 1,
      duration: lastLevel?.duration || 20,
      smallBlind: lastLevel ? lastLevel.bigBlind : 100,
      bigBlind: lastLevel ? lastLevel.bigBlind * 2 : 200,
      isbreak: false,
    };
    setLevels([...levels, newLevel]);
  };

  const handleAddBreak = () => {
    const newBreak: BlindLevel = {
      level: levels.length + 1,
      duration: 15,
      smallBlind: 0,
      bigBlind: 0,
      isbreak: true,
    };
    setLevels([...levels, newBreak]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(levels);
      onClose();
    } catch (error) {
      console.error("Error saving blind schedule:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const currentScheduleName =
    BLIND_SCHEDULES[currentScheduleId]?.name || currentScheduleId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Blind Schedule
            </h2>
            <p className="text-sm text-gray-500">
              Based on: {currentScheduleName}
              {customLevels && " (customized)"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X
              size={20}
              className="text-gray-500"
            />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Level
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Duration (min)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Small Blind
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Big Blind
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Ante
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    Break
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {levels.map((level, index) => (
                  <tr
                    key={index}
                    className={level.isbreak ? "bg-yellow-50" : ""}
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-900">
                        {level.level}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={level.duration}
                        onChange={(e) =>
                          handleLevelChange(
                            index,
                            "duration",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-black text-center"
                        min="1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step={50}
                        value={level.smallBlind}
                        onChange={(e) =>
                          handleLevelChange(
                            index,
                            "smallBlind",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-black text-center"
                        min="0"
                        disabled={level.isbreak}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step={50}
                        value={level.bigBlind}
                        onChange={(e) =>
                          handleLevelChange(
                            index,
                            "bigBlind",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-black text-center"
                        min="0"
                        disabled={level.isbreak}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step={50}
                        value={level.ante || 0}
                        onChange={(e) =>
                          handleLevelChange(
                            index,
                            "ante",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-black text-center"
                        min="0"
                        disabled={level.isbreak}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={level.isbreak || false}
                        onChange={(e) =>
                          handleLevelChange(index, "isbreak", e.target.checked)
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDeleteLevel(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete level"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddLevel}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Add Level
            </button>
            <button
              onClick={handleAddBreak}
              className="flex items-center gap-1 px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
            >
              <Plus size={16} />
              Add Break
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
