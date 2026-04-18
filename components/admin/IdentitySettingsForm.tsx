'use client';

import { useState, useRef } from 'react';
import { LeagueConfig } from '@/types/league-config';
import Image from 'next/image';

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
  initialLeagueName: string;
}

export default function IdentitySettingsForm({ leagueSlug, initialConfig, initialLeagueName }: Props) {
  const [form, setForm] = useState({
    leagueName:     initialLeagueName,
    leagueImageUrl: initialConfig.leagueImageUrl ?? '',
    contactEmail:   initialConfig.contactEmail ?? '',
    timezone:       initialConfig.timezone,
    socialFacebook: initialConfig.socialLinks.facebook ?? '',
    socialDiscord:  initialConfig.socialLinks.discord ?? '',
    socialWebsite:  initialConfig.socialLinks.website ?? '',
    pwaShortName:       initialConfig.pwa.shortName ?? '',
    pwaThemeColor:      initialConfig.pwa.themeColor ?? '#06b6d4',
    pwaBackgroundColor: initialConfig.pwa.backgroundColor ?? '#0f172a',
    pwaLogoUrl:         initialConfig.pwa.logoUrl ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        pwa: {
          shortName:       form.pwaShortName || '',
          themeColor:      form.pwaThemeColor || '#06b6d4',
          backgroundColor: form.pwaBackgroundColor || '#0f172a',
          logoUrl:         form.pwaLogoUrl || '',
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

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Allowed: JPG, PNG, GIF, WebP, HEIC');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 10MB');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('icon', file);

      const res = await fetch(`/api/${leagueSlug}/admin/pwa-icon`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      setForm(prev => ({ ...prev, pwaLogoUrl: data.logoUrl }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleIconDelete() {
    if (!form.pwaLogoUrl) return;
    if (!confirm('Remove the app icon?')) return;

    setUploading(true);
    setUploadError(null);

    try {
      const res = await fetch(`/api/${leagueSlug}/admin/pwa-icon`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }

      setForm(prev => ({ ...prev, pwaLogoUrl: '' }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setUploading(false);
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

      {/* PWA Settings */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div>
          <p className="text-sm text-white/60">App Install Settings (PWA)</p>
          <p className="text-xs text-white/30 mt-1">
            These settings control how your league appears when installed to a phone&apos;s home screen.
          </p>
        </div>

        {/* Short Name */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Short Name</label>
          <input
            type="text"
            value={form.pwaShortName}
            onChange={e => handleChange('pwaShortName', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white
                       focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            placeholder={initialLeagueName}
            maxLength={12}
          />
          <p className="text-xs text-white/30 mt-1">
            Displayed under the app icon (max 12 characters). Defaults to league name.
          </p>
        </div>

        {/* App Icon */}
        <div>
          <label className="block text-xs text-white/40 mb-2">App Icon</label>
          <div className="flex items-start gap-4">
            {/* Icon Preview */}
            <div className="w-20 h-20 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.pwaLogoUrl ? (
                <Image
                  src={form.pwaLogoUrl}
                  alt="App icon"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-white/20 text-xs text-center px-2">No icon</span>
              )}
            </div>

            {/* Upload Controls */}
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                onChange={handleIconUpload}
                className="hidden"
                id="pwa-icon-upload"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50
                             text-white rounded-lg text-sm transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload Icon'}
                </button>
                {form.pwaLogoUrl && (
                  <button
                    type="button"
                    onClick={handleIconDelete}
                    disabled={uploading}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50
                               text-red-400 rounded-lg text-sm transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              {uploadError && (
                <p className="text-red-400 text-xs">{uploadError}</p>
              )}
              <p className="text-xs text-white/30">
                512x512 PNG recommended. Image will be resized automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Theme and Background Colors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1">Theme Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.pwaThemeColor}
                onChange={e => handleChange('pwaThemeColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border border-white/10"
              />
              <input
                type="text"
                value={form.pwaThemeColor}
                onChange={e => handleChange('pwaThemeColor', e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                placeholder="#06b6d4"
              />
            </div>
            <p className="text-xs text-white/30 mt-1">Browser toolbar color</p>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.pwaBackgroundColor}
                onChange={e => handleChange('pwaBackgroundColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border border-white/10"
              />
              <input
                type="text"
                value={form.pwaBackgroundColor}
                onChange={e => handleChange('pwaBackgroundColor', e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                placeholder="#0f172a"
              />
            </div>
            <p className="text-xs text-white/30 mt-1">Splash screen color</p>
          </div>
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
