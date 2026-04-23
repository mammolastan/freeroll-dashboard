// app/admin/tournament-entry/screens/Screen1_FullAdmin/BlindScheduleEditModal.tsx

"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { BlindLevel } from "@/lib/blindLevels";

interface BlindScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: number;
  currentScheduleId: string;
  currentScheduleName: string;
  /** Levels to edit: tournament custom override, or preset schedule levels from parent */
  customLevels: BlindLevel[] | null;
  /** True when draft has saved custom_blind_levels (vs editing a preset copy) */
  isCustomized: boolean;
  onSave: (levels: BlindLevel[]) => Promise<void>;
  /** Refresh league schedule list after "Save to league" succeeds */
  onSavedToLeague?: () => void;
  /** Current blind level the timer is on (1-indexed). Levels <= this are locked by default. */
  currentTimerLevel?: number;
}

export function BlindScheduleEditModal({
  isOpen,
  onClose,
  currentScheduleName,
  customLevels,
  isCustomized,
  onSave,
  onSavedToLeague,
  currentTimerLevel = 1,
}: BlindScheduleEditModalProps) {
  const [levels, setLevels] = useState<BlindLevel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // "Start New" mode: when true, all levels are unlocked for creating a new schedule
  const [isStartNewMode, setIsStartNewMode] = useState(false);

  const [saveToLeagueOpen, setSaveToLeagueOpen] = useState(false);
  const [saveToLeagueTitle, setSaveToLeagueTitle] = useState("");
  const [saveToLeagueDescription, setSaveToLeagueDescription] = useState("");
  const [saveToLeagueError, setSaveToLeagueError] = useState<string | null>(
    null,
  );
  const [savingToLeague, setSavingToLeague] = useState(false);

  // Initialize levels when modal opens or when seed data arrives (schedules may load async)
  useEffect(() => {
    if (isOpen) {
      const initialLevels = customLevels ?? [];
      setLevels(JSON.parse(JSON.stringify(initialLevels)));
    }
  }, [isOpen, customLevels]);

  useEffect(() => {
    if (!isOpen) {
      setSaveToLeagueOpen(false);
      setSaveToLeagueTitle("");
      setSaveToLeagueDescription("");
      setSaveToLeagueError(null);
      setIsStartNewMode(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const openSaveToLeagueDialog = () => {
    setSaveToLeagueTitle(
      currentScheduleName && currentScheduleName !== "Custom"
        ? currentScheduleName
        : "",
    );
    setSaveToLeagueDescription("");
    setSaveToLeagueError(null);
    setSaveToLeagueOpen(true);
  };

  const submitSaveToLeague = async () => {
    const name = saveToLeagueTitle.trim();
    if (!name) {
      setSaveToLeagueError("Title is required.");
      return;
    }
    setSavingToLeague(true);
    setSaveToLeagueError(null);
    try {
      const res = await fetch("/api/blind-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: saveToLeagueDescription.trim(),
          levels,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSaveToLeagueError(data.error ?? "Failed to save schedule.");
        return;
      }
      setSaveToLeagueOpen(false);
      onSavedToLeague?.();
    } catch {
      setSaveToLeagueError("Network error — try again.");
    } finally {
      setSavingToLeague(false);
    }
  };

  const handleLevelChange = (
    index: number,
    field: keyof BlindLevel,
    value: number | boolean,
  ) => {
    // Don't allow changing locked levels (current or previous)
    const level = levels[index];
    if (!isStartNewMode && level && level.level <= currentTimerLevel) {
      return;
    }
    setLevels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteLevel = (index: number) => {
    // Don't allow deleting locked levels (current or previous)
    const level = levels[index];
    if (!isStartNewMode && level && level.level <= currentTimerLevel) {
      return;
    }
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

  // currentScheduleName is now passed as a prop

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Edit Blind Schedule
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Based on: {currentScheduleName}
              {isCustomized && " (customized)"}
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
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                {levels.map((level, index) => {
                  // Lock levels at or before current timer level (unless in Start New mode)
                  const isLocked = !isStartNewMode && level.level <= currentTimerLevel;
                  return (
                    <tr
                      key={index}
                      className={`${level.isbreak ? "bg-yellow-50" : ""} ${isLocked ? "opacity-60 bg-gray-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-gray-900">
                          {level.level}
                          {isLocked && <span className="ml-1 text-gray-400 text-xs">🔒</span>}
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
                          className={`w-20 px-2 py-1 border border-gray-300 rounded text-black text-center ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          min="1"
                          disabled={isLocked}
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
                          className={`w-24 px-2 py-1 border border-gray-300 rounded text-black text-center ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          min="0"
                          disabled={level.isbreak || isLocked}
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
                          className={`w-24 px-2 py-1 border border-gray-300 rounded text-black text-center ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          min="0"
                          disabled={level.isbreak || isLocked}
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
                          className={`w-20 px-2 py-1 border border-gray-300 rounded text-black text-center ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          min="0"
                          disabled={level.isbreak || isLocked}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={level.isbreak || false}
                          onChange={(e) =>
                            handleLevelChange(index, "isbreak", e.target.checked)
                          }
                          className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${isLocked ? "cursor-not-allowed" : ""}`}
                          disabled={isLocked}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleDeleteLevel(index)}
                          className={`p-1 rounded transition-colors ${isLocked ? "text-gray-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50"}`}
                          title={isLocked ? "Cannot delete locked level" : "Delete level"}
                          disabled={isLocked}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {levels.map((level, index) => {
              const isLocked = !isStartNewMode && level.level <= currentTimerLevel;
              return (
                <div
                  key={index}
                  className={`border rounded-lg p-3 ${level.isbreak ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-200"} ${isLocked ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-gray-900">
                      {level.isbreak ? `Break` : `Level ${level.level}`}
                      {isLocked && <span className="ml-1 text-gray-400 text-xs">🔒</span>}
                    </span>
                    <button
                      onClick={() => handleDeleteLevel(index)}
                      className={`p-1.5 rounded transition-colors ${isLocked ? "text-gray-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50"}`}
                      title={isLocked ? "Cannot delete locked level" : "Delete level"}
                      disabled={isLocked}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Duration (min)
                      </label>
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
                        className={`w-full px-2 py-1.5 border border-gray-300 rounded text-black text-center ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        min="1"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`break-${index}`}
                        checked={level.isbreak || false}
                        onChange={(e) =>
                          handleLevelChange(index, "isbreak", e.target.checked)
                        }
                        className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${isLocked ? "cursor-not-allowed" : ""}`}
                        disabled={isLocked}
                      />
                      <label
                        htmlFor={`break-${index}`}
                        className="text-sm text-gray-700"
                      >
                        Break
                      </label>
                    </div>
                  </div>

                  {!level.isbreak && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Small
                        </label>
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
                          className={`w-full px-2 py-1.5 border border-gray-300 rounded text-black text-center text-sm ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          min="0"
                          disabled={isLocked}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Big
                        </label>
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
                          className={`w-full px-2 py-1.5 border border-gray-300 rounded text-black text-center text-sm ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          min="0"
                          disabled={isLocked}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Ante
                        </label>
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
                          className={`w-full px-2 py-1.5 border border-gray-300 rounded text-black text-center text-sm ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          min="0"
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button
              onClick={handleAddLevel}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Add Level
            </button>
            <button
              onClick={handleAddBreak}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
            >
              <Plus size={16} />
              Add Break
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-3 sm:p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          {isStartNewMode ? (
            /* Start New Mode: show Save to League button */
            <button
              type="button"
              onClick={openSaveToLeagueDialog}
              className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm transition-colors"
              title="Save these levels as a reusable league schedule"
            >
              Save to League
            </button>
          ) : (
            /* Normal Mode: show Start New and Save Local Changes buttons */
            <>
              <button
                type="button"
                onClick={() => setIsStartNewMode(true)}
                className="px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-sm transition-colors"
                title="Unlock all levels to create an entirely new blind schedule"
              >
                Start New
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Local Changes"}
              </button>
            </>
          )}
        </div>
      </div>

      {saveToLeagueOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !savingToLeague && setSaveToLeagueOpen(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md border border-gray-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="save-to-league-title"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3
                id="save-to-league-title"
                className="text-lg font-semibold text-gray-900"
              >
                Save to league schedules
              </h3>
              <button
                type="button"
                onClick={() => !savingToLeague && setSaveToLeagueOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label
                  htmlFor="save-to-league-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Title
                </label>
                <textarea
                  id="save-to-league-name"
                  rows={1}
                  value={saveToLeagueTitle}
                  onChange={(e) => setSaveToLeagueTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none overflow-hidden"
                  placeholder="e.g. Tuesday turbo"
                  disabled={savingToLeague}
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="save-to-league-desc"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="save-to-league-desc"
                  value={saveToLeagueDescription}
                  onChange={(e) => setSaveToLeagueDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y min-h-[80px]"
                  placeholder="Optional notes for TDs"
                  disabled={savingToLeague}
                />
              </div>
              {saveToLeagueError && (
                <p className="text-sm text-red-600">{saveToLeagueError}</p>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => !savingToLeague && setSaveToLeagueOpen(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={savingToLeague}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitSaveToLeague()}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                disabled={savingToLeague}
              >
                {savingToLeague ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
