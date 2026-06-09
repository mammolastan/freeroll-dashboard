// components/TournamentFeed/HitmanClaimModal.tsx

"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Skull, Loader2 } from "lucide-react";

interface HitmanClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  eliminatedPlayerName: string;
  claimerName: string;
  onConfirm: () => Promise<void>;
}

export function HitmanClaimModal({
  isOpen,
  onClose,
  eliminatedPlayerName,
  claimerName,
  onConfirm,
}: HitmanClaimModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
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
            Claim Knockout
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="text-center py-4">
          <p className="text-gray-300 text-lg">
            <span className="text-red-400 font-semibold">{eliminatedPlayerName}</span>
            <span className="text-gray-500"> KO&apos;d by </span>
            <span className="text-cyan-400 font-semibold">{claimerName}</span>
          </p>
          <p className="text-gray-500 text-sm mt-3">
            Your claim will be sent to the Tournament Director for approval.
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
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Confirm Claim"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
