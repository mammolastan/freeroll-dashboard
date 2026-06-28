// components/TournamentFeed/KnockoutReportModal.tsx

"use client";

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Skull, Loader2, Search, ChevronDown } from "lucide-react";
import { Player } from "@/lib/realtime/types";

interface KnockoutReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  victimPlayer: { id: number; name: string };
  remainingPlayers: Player[];
  currentUserUid?: string;
  onConfirm: (hitmanPlayerId: number) => Promise<void>;
}

export function KnockoutReportModal({
  isOpen,
  onClose,
  victimPlayer,
  remainingPlayers,
  currentUserUid,
  onConfirm,
}: KnockoutReportModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHitman, setSelectedHitman] = useState<Player | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Filter out the victim from the hitman selection list
  const availableHitmen = useMemo(() => {
    return remainingPlayers.filter((p) => p.id !== victimPlayer.id);
  }, [remainingPlayers, victimPlayer.id]);

  // Filter based on search term
  const filteredHitmen = useMemo(() => {
    if (!searchTerm.trim()) return availableHitmen;
    const term = searchTerm.toLowerCase();
    return availableHitmen.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.nickname && p.nickname.toLowerCase().includes(term))
    );
  }, [availableHitmen, searchTerm]);

  // Default to current user if they're in the remaining players
  React.useEffect(() => {
    if (isOpen && currentUserUid && !selectedHitman) {
      const currentUserPlayer = availableHitmen.find(
        (p) => p.uid === currentUserUid
      );
      if (currentUserPlayer) {
        setSelectedHitman(currentUserPlayer);
      }
    }
  }, [isOpen, currentUserUid, availableHitmen, selectedHitman]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedHitman(null);
      setSearchTerm("");
      setError(null);
      setDropdownOpen(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!selectedHitman) {
      setError("Please select who knocked out this player");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedHitman.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectHitman = (player: Player) => {
    setSelectedHitman(player);
    setDropdownOpen(false);
    setSearchTerm("");
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-cyan-500/30 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.3)] p-6 max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
            <Skull className="h-5 w-5 text-red-400" />
            Report Knockout
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4">
          <p className="text-gray-300 text-center mb-4">
            <span className="text-red-400 font-semibold">
              {victimPlayer.name}
            </span>
            <span className="text-gray-500"> was knocked out by...</span>
          </p>

          {/* Hitman Selection Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-cyan-500/50 transition-colors text-left"
            >
              {selectedHitman ? (
                <span className="text-cyan-300 font-medium">
                  {selectedHitman.nickname || selectedHitman.name}
                  {selectedHitman.uid === currentUserUid && (
                    <span className="text-gray-500 ml-2">(Me)</span>
                  )}
                </span>
              ) : (
                <span className="text-gray-500">Select hitman...</span>
              )}
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
                {/* Search Input */}
                <div className="p-2 border-b border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search players..."
                      className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Player List */}
                <div className="overflow-y-auto max-h-48">
                  {filteredHitmen.length === 0 ? (
                    <div className="px-4 py-3 text-gray-500 text-sm text-center">
                      No players found
                    </div>
                  ) : (
                    filteredHitmen.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => handleSelectHitman(player)}
                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-700 transition-colors flex items-center justify-between ${
                          selectedHitman?.id === player.id
                            ? "bg-cyan-500/20 text-cyan-300"
                            : "text-gray-300"
                        }`}
                      >
                        <span>
                          {player.nickname || player.name}
                        </span>
                        {player.uid === currentUserUid && (
                          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                            Me
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-gray-500 text-sm mt-4 text-center">
            Your report will be sent to the Tournament Director for approval.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !selectedHitman}
            className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Report Knockout"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
