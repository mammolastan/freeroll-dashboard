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
    allowSelfCheckIn: initialConfig.gameDefaults.allowSelfCheckIn,
    defaultTDMessage: initialConfig.gameDefaults.defaultTDMessage || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle(field: 'allowChat' | 'allowSelfCheckIn') {
    setForm(prev => ({ ...prev, [field]: !prev[field] }));
    setSaved(false);
  }

  function handleTextChange(field: 'defaultTDMessage', value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
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
          allowSelfCheckIn: form.allowSelfCheckIn,
          defaultTDMessage: form.defaultTDMessage,
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
            className={`relative shrink-0 w-10 h-6 rounded-full transition-colors outline-none focus:outline-none ${
              form.allowChat ? 'bg-cyan-600' : 'bg-white/20'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                form.allowChat ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Allow Self Check-In Toggle */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Allow Self Check-In</h3>
            <p className="text-white/40 text-sm mt-1">
              When enabled, players can check themselves in from the public game view page
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.allowSelfCheckIn}
            onClick={() => handleToggle('allowSelfCheckIn')}
            className={`relative shrink-0 w-10 h-6 rounded-full transition-colors outline-none focus:outline-none ${
              form.allowSelfCheckIn ? 'bg-cyan-600' : 'bg-white/20'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                form.allowSelfCheckIn ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Default TD Message */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div>
          <h3 className="text-white font-medium">Default TD Message</h3>
          <p className="text-white/40 text-sm mt-1 mb-4">
            Displayed on the TV screen when there are no TD messages.
            Supports markdown formatting.
          </p>
          <textarea
            value={form.defaultTDMessage}
            onChange={(e) => handleTextChange('defaultTDMessage', e.target.value)}
            placeholder="Welcome to tonight's tournament! Good luck everyone..."
            rows={4}
            className="w-full px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white placeholder-white/30
                       focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-y"
          />
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
