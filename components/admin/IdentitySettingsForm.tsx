'use client';

import { useState } from 'react';
import { LeagueConfig } from '@/types/league-config';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

interface Props {
  leagueSlug: string;
  initialConfig: LeagueConfig;
}

export default function IdentitySettingsForm({ leagueSlug, initialConfig }: Props) {
  const [form, setForm] = useState({
    leagueName:     initialConfig.leagueName,
    leagueImageUrl: initialConfig.leagueImageUrl ?? '',
    contactEmail:   initialConfig.contactEmail ?? '',
    timezone:       initialConfig.timezone,
    socialFacebook: initialConfig.socialLinks.facebook ?? '',
    socialDiscord:  initialConfig.socialLinks.discord ?? '',
    socialWebsite:  initialConfig.socialLinks.website ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const patch: Partial<LeagueConfig> = {
        leagueName:     form.leagueName,
        leagueImageUrl: form.leagueImageUrl || null,
        contactEmail:   form.contactEmail || null,
        timezone:       form.timezone,
        socialLinks: {
          facebook: form.socialFacebook || undefined,
          discord:  form.socialDiscord  || undefined,
          website:  form.socialWebsite  || undefined,
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
      {/* League Name */}
      <div>
        <label className="block text-sm text-white/60 mb-1">League Name</label>
        <input
          type="text"
          value={form.leagueName}
          onChange={e => handleChange('leagueName', e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white
                     focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
          placeholder="My Poker League"
        />
      </div>

      {/* Image URL */}
      <div>
        <label className="block text-sm text-white/60 mb-1">League Image URL</label>
        <input
          type="url"
          value={form.leagueImageUrl}
          onChange={e => handleChange('leagueImageUrl', e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white
                     focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
          placeholder="https://..."
        />
        <p className="text-xs text-white/30 mt-1">Used as the loading screen image</p>
      </div>

      {/* Contact Email */}
      <div>
        <label className="block text-sm text-white/60 mb-1">Contact Email</label>
        <input
          type="email"
          value={form.contactEmail}
          onChange={e => handleChange('contactEmail', e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white
                     focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
          placeholder="info@myleague.com"
        />
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm text-white/60 mb-1">Timezone</label>
        <select
          value={form.timezone}
          onChange={e => handleChange('timezone', e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white
                     focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz} className="bg-gray-900">
              {tz.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Social Links */}
      <div className="space-y-3">
        <p className="text-sm text-white/60">Social Links</p>
        {[
          { key: 'socialFacebook', label: 'Facebook', placeholder: 'https://facebook.com/groups/...' },
          { key: 'socialDiscord',  label: 'Discord',  placeholder: 'https://discord.gg/...' },
          { key: 'socialWebsite',  label: 'Website',  placeholder: 'https://myleague.com' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs text-white/40 mb-1">{label}</label>
            <input
              type="url"
              value={form[key as keyof typeof form]}
              onChange={e => handleChange(key as keyof typeof form, e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white
                         focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
              placeholder={placeholder}
            />
          </div>
        ))}
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
