'use client';

import { useState } from 'react';
import { THEME_PRESETS, ThemePreset } from '@/lib/themes';
import { Check } from 'lucide-react';

interface Props {
  leagueSlug: string;
  initialThemeId: string;
}

function ThemeCard({
  theme,
  isSelected,
  onSelect,
}: {
  theme: ThemePreset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center p-4 rounded-lg border-2 transition-all
        ${
          isSelected
            ? 'border-cyan-500 bg-cyan-500/10'
            : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
        }`}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
          <Check size={12} className="text-white" />
        </div>
      )}

      {/* Color swatches */}
      <div className="flex gap-1 mb-3">
        <div
          className="w-8 h-8 rounded-md border border-white/20"
          style={{ backgroundColor: theme.colors.primary }}
          title="Primary"
        />
        <div
          className="w-8 h-8 rounded-md border border-white/20"
          style={{ backgroundColor: theme.colors.surface }}
          title="Surface"
        />
      </div>

      {/* Theme name */}
      <span className="text-sm text-white font-medium">{theme.name}</span>
    </button>
  );
}

export default function BrandingSettingsForm({ leagueSlug, initialThemeId }: Props) {
  const [selectedThemeId, setSelectedThemeId] = useState(initialThemeId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = selectedThemeId !== initialThemeId;

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/${leagueSlug}/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branding: {
            themeId: selectedThemeId,
          },
        }),
      });

      if (!res.ok) throw new Error('Save failed');
      setSaved(true);

      // Reload to apply theme changes
      window.location.reload();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Theme Grid */}
      <div>
        <label className="block text-sm text-white/60 mb-3">Color Theme</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {THEME_PRESETS.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isSelected={selectedThemeId === theme.id}
              onSelect={() => {
                setSelectedThemeId(theme.id);
                setSaved(false);
              }}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <label className="block text-sm text-white/60 mb-3">Preview</label>
        <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-4">
          {(() => {
            const theme = THEME_PRESETS.find((t) => t.id === selectedThemeId) ?? THEME_PRESETS[0];
            return (
              <>
                {/* Home tiles preview */}
                <div>
                  <p className="text-xs text-white/40 mb-2">Home Tiles</p>
                  <div className="flex gap-3">
                    <div
                      className="flex flex-col items-center justify-center p-4 rounded-lg w-24 h-24"
                      style={{ backgroundColor: theme.colors.surface }}
                    >
                      <div
                        className="w-6 h-6 rounded mb-2"
                        style={{ backgroundColor: theme.colors.primary }}
                      />
                      <span className="text-xs text-white/80">Tile</span>
                    </div>
                    <div
                      className="flex flex-col items-center justify-center p-4 rounded-lg w-24 h-24"
                      style={{ backgroundColor: theme.colors.surfaceHover }}
                    >
                      <div
                        className="w-6 h-6 rounded mb-2"
                        style={{ backgroundColor: theme.colors.primaryHover }}
                      />
                      <span className="text-xs text-white/80">Hover</span>
                    </div>
                  </div>
                </div>

                {/* Ranking card colors preview */}
                <div>
                  <p className="text-xs text-white/40 mb-2">Ranking Card Stats</p>
                  <div className="flex gap-1">
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-xs font-bold text-gray-800"
                      style={{ backgroundColor: theme.colors.rankingBadge }}
                      title="Ranking Badge"
                    >
                      #1
                    </div>
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-xs font-medium text-gray-700"
                      style={{ backgroundColor: theme.colors.stat1 }}
                      title="Stat 1 (Points)"
                    >
                      S1
                    </div>
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-xs font-medium text-gray-700"
                      style={{ backgroundColor: theme.colors.stat2 }}
                      title="Stat 2"
                    >
                      S2
                    </div>
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-xs font-medium text-gray-700"
                      style={{ backgroundColor: theme.colors.stat3 }}
                      title="Stat 3"
                    >
                      S3
                    </div>
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-xs font-medium text-gray-700"
                      style={{ backgroundColor: theme.colors.stat4 }}
                      title="Stat 4"
                    >
                      S4
                    </div>
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-xs font-medium text-gray-700"
                      style={{ backgroundColor: theme.colors.stat5 }}
                      title="Stat 5"
                    >
                      S5
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && <p className="text-cyan-400 text-sm">Saved! Reloading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!hasChanges && !saved && (
          <p className="text-white/40 text-sm">Select a theme to enable save</p>
        )}
      </div>
    </div>
  );
}
