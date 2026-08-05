'use client';

import { useState } from 'react';
import { HomepageTilesConfig } from '@/types/league-config';
import {
  GalleryHorizontalEnd,
  ClipboardCheck,
  Trophy,
  CircleUserRound,
  Store,
  Award,
  Download,
} from 'lucide-react';

interface TileOption {
  key: keyof HomepageTilesConfig;
  label: string;
  description: string;
  icon: React.ElementType;
}

const TILE_OPTIONS: TileOption[] = [
  {
    key: 'recentGames',
    label: 'Recent Games',
    description: 'Show completed games and results',
    icon: GalleryHorizontalEnd,
  },
  {
    key: 'activeGames',
    label: 'Active Games',
    description: 'Show games currently in progress for check-in',
    icon: ClipboardCheck,
  },
  {
    key: 'seasonRankings',
    label: 'Season Rankings',
    description: 'Show rankings for competition periods with type "season"',
    icon: Trophy,
  },
  {
    key: 'quarterlyRankings',
    label: 'Quarterly Rankings',
    description: 'Show rankings for competition periods with type "quarterly"',
    icon: Trophy,
  },
  {
    key: 'monthlyRankings',
    label: 'Monthly Rankings',
    description: 'Show rankings for competition periods with type "monthly"',
    icon: Trophy,
  },
  {
    key: 'players',
    label: 'Players',
    description: 'Show player directory and profiles',
    icon: CircleUserRound,
  },
  {
    key: 'venues',
    label: 'Venues',
    description: 'Show venue list and information',
    icon: Store,
  },
  {
    key: 'badges',
    label: 'Badges',
    description: 'Show available badges and achievements',
    icon: Award,
  },
  {
    key: 'installApp',
    label: 'Install App',
    description: 'Show button to install the app to home screen',
    icon: Download,
  },
];

interface Props {
  leagueSlug: string;
  initialTiles: HomepageTilesConfig;
}

export default function NavigationSettingsForm({ leagueSlug, initialTiles }: Props) {
  const [tiles, setTiles] = useState<HomepageTilesConfig>(initialTiles);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle(key: keyof HomepageTilesConfig) {
    setTiles(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/${leagueSlug}/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homepageTiles: tiles }),
      });

      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Count enabled tiles
  const enabledCount = Object.values(tiles).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm text-white/60">
            {enabledCount} of {TILE_OPTIONS.length} tiles enabled
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {TILE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isEnabled = tiles[option.key];

            return (
              <div
                key={option.key}
                className="px-4 py-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${isEnabled ? 'bg-cyan-500/20' : 'bg-white/5'}`}>
                    <Icon
                      size={20}
                      className={isEnabled ? 'text-cyan-400' : 'text-white/40'}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-medium ${isEnabled ? 'text-white' : 'text-white/50'}`}>
                      {option.label}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {option.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(option.key)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    isEnabled ? 'bg-cyan-600' : 'bg-white/20'
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`Toggle ${option.label}`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
        <p className="text-amber-200 text-sm">
          These settings control which tiles appear on your league&apos;s homepage and in the
          navigation menu. Disabled tiles will be hidden from all users.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && <p className="text-cyan-400 text-sm">Saved</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
