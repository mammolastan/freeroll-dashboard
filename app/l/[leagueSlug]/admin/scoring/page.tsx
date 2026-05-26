// app/[leagueSlug]/admin/scoring/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Trash2, Plus, Lock, Unlock } from "lucide-react";

interface ScoringRule {
  placement: number;
  points: number;
}

interface ScoringSystemConfig {
  rules: ScoringRule[];
  defaultPoints: number;
}

const DEFAULT_SCORING_SYSTEM: ScoringSystemConfig = {
  rules: [
    { placement: 1, points: 10 },
    { placement: 2, points: 7 },
    { placement: 3, points: 6 },
    { placement: 4, points: 5 },
    { placement: 5, points: 4 },
    { placement: 6, points: 3 },
    { placement: 7, points: 2 },
    { placement: 8, points: 1 },
  ],
  defaultPoints: 0,
};

const TEN_POINT_SPREAD: ScoringSystemConfig = {
  rules: [
    { placement: 1, points: 100 },
    { placement: 2, points: 90 },
    { placement: 3, points: 80 },
    { placement: 4, points: 70 },
    { placement: 5, points: 60 },
    { placement: 6, points: 50 },
    { placement: 7, points: 40 },
    { placement: 8, points: 30 },
    { placement: 9, points: 20 },
    { placement: 10, points: 10 },
  ],
  defaultPoints: 0,
};

export default function ScoringPage() {
  const params = useParams();
  const leagueSlug = params.leagueSlug as string;

  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [defaultPoints, setDefaultPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [locked, setLocked] = useState(true);

  // Fetch current config on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch(`/api/${leagueSlug}/admin/scoring`);
        if (!res.ok) throw new Error("Failed to load scoring config");
        const data = await res.json();
        setRules(data.scoringSystem.rules);
        setDefaultPoints(data.scoringSystem.defaultPoints);
      } catch {
        setError("Failed to load scoring configuration");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [leagueSlug]);

  function handlePointsChange(placement: number, points: number) {
    setRules((prev) =>
      prev.map((rule) =>
        rule.placement === placement ? { ...rule, points } : rule,
      ),
    );
    setSaved(false);
    setValidationErrors([]);
  }

  function handleAddPlacement() {
    const nextPlacement =
      rules.length > 0 ? Math.max(...rules.map((r) => r.placement)) + 1 : 1;
    setRules((prev) => [...prev, { placement: nextPlacement, points: 0 }]);
    setSaved(false);
    setValidationErrors([]);
  }

  function handleRemoveLastPlacement() {
    if (rules.length > 1) {
      setRules((prev) => prev.slice(0, -1));
      setSaved(false);
      setValidationErrors([]);
    }
  }

  function loadPreset(preset: ScoringSystemConfig) {
    setRules([...preset.rules]);
    setDefaultPoints(preset.defaultPoints);
    setSaved(false);
    setValidationErrors([]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setValidationErrors([]);
    setSaved(false);

    try {
      const scoringSystem: ScoringSystemConfig = {
        rules,
        defaultPoints,
      };

      const res = await fetch(`/api/${leagueSlug}/admin/scoring`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoringSystem }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          setValidationErrors(data.details);
        } else {
          throw new Error(data.error || "Save failed");
        }
        return;
      }

      setSaved(true);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold text-white mb-1">Scoring</h2>
        <p className="text-white/40 text-sm mb-8">
          Configure placement points for tournaments
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/30 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-1">Scoring</h2>
      <p className="text-white/40 text-sm mb-8">
        Configure placement points for tournaments
      </p>

      {/* Lock/Unlock Toggle */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {locked ? (
              <Lock size={18} className="text-white/40" />
            ) : (
              <Unlock size={18} className="text-cyan-400" />
            )}
            <div>
              <p className="text-white text-sm">
                {locked
                  ? "This is your league's current points assignments."
                  : "Editing enabled. Make changes below."}
              </p>
              <p className="text-white/40 text-xs mt-0.5">
                {locked ? "Unlock to edit." : "Lock when finished to prevent accidental changes."}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!locked}
            onClick={() => setLocked(!locked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              !locked ? "bg-cyan-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                !locked ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/60 text-sm font-medium px-4 py-3">
                Place
              </th>
              <th className="text-left text-white/60 text-sm font-medium px-4 py-3">
                Points
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr
                key={rule.placement}
                className="border-b border-white/5 last:border-b-0"
              >
                <td className="px-4 py-3">
                  <span className="text-white/60">
                    {rule.placement}
                    {getOrdinalSuffix(rule.placement)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={rule.points}
                    disabled={locked}
                    onChange={(e) =>
                      handlePointsChange(
                        rule.placement,
                        parseInt(e.target.value) || 0,
                      )
                    }
                    className={`w-20 px-3 py-1.5 bg-gray-800 border border-white/20 rounded-lg text-white text-center
                               focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                               ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  {index === rules.length - 1 && rules.length > 1 && !locked && (
                    <button
                      onClick={handleRemoveLastPlacement}
                      className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                      title="Remove last placement"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add Placement Button */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleAddPlacement}
            disabled={locked}
            className={`flex items-center gap-2 text-sm transition-colors
                       ${locked ? "text-white/20 cursor-not-allowed" : "text-cyan-400 hover:text-cyan-300"}`}
          >
            <Plus size={16} />
            Add placement
          </button>
        </div>
      </div>

      {/* Default Points */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Default Points</h3>
            <p className="text-white/40 text-sm mt-1">
              Points for all other finishers (any place not listed above)
            </p>
          </div>
          <input
            type="number"
            min="0"
            value={defaultPoints}
            disabled={locked}
            onChange={(e) => {
              setDefaultPoints(parseInt(e.target.value) || 0);
              setSaved(false);
              setValidationErrors([]);
            }}
            className={`w-20 px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white text-center
                       focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                       ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
          />
        </div>
      </div>

      {/* Presets */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => loadPreset(DEFAULT_SCORING_SYSTEM)}
          disabled={locked}
          className={`px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm transition-colors
                     ${locked ? "opacity-50 cursor-not-allowed text-white/40" : "hover:bg-white/10 text-white/80"}`}
        >
          Standard
        </button>
        <button
          onClick={() => loadPreset(TEN_POINT_SPREAD)}
          disabled={locked}
          className={`px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm transition-colors
                     ${locked ? "opacity-50 cursor-not-allowed text-white/40" : "hover:bg-white/10 text-white/80"}`}
        >
          10-point spread
        </button>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm font-medium mb-2">
            Validation errors:
          </p>
          <ul className="list-disc list-inside text-red-300 text-sm space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || locked}
          className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? "Saving..." : "Save scoring system"}
        </button>
        {saved && <p className="text-cyan-400 text-sm">Saved</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
