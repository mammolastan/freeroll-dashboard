'use client';

import { useState } from 'react';
import { LeagueConfig } from '@/types/league-config';

interface Props {
  leagueSlug: string;
  initialConfig: LeagueConfig;
}

export default function GameDefaultsForm({ leagueSlug, initialConfig }: Props) {
  const [form, setForm] = useState({
    allowChat: initialConfig.gameDefaults.allowChat,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle(field: keyof typeof form) {
    setForm(prev => ({ ...prev, [field]: !prev[field] }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const patch: Partial<LeagueConfig> = {
        gameDefaults: {
          ...initialConfig.gameDefaults,
          allowChat: form.allowChat,
        },
      };

      const res = await fetch(`/api/${leagueSlug}/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Allow Chat Toggle */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Allow Chat</h3>
            <p className="text-white/40 text-sm mt-1">
              When enabled, players can send messages in the tournament feed
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.allowChat}
            onClick={() => handleToggle('allowChat')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              form.allowChat ? 'bg-cyan-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.allowChat ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4 pt-2">
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
