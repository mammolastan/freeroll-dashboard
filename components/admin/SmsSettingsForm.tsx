'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';

interface Props {
  leagueSlug: string;
  initialSmsEnabled: boolean;
}

export default function SmsSettingsForm({ leagueSlug, initialSmsEnabled }: Props) {
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const newValue = !smsEnabled;
    setSmsEnabled(newValue);
    setSaved(false);
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/${leagueSlug}/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsEnabled: newValue }),
      });

      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
    } catch {
      setError('Failed to save. Please try again.');
      setSmsEnabled(!newValue); // Revert on error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${smsEnabled ? 'bg-cyan-500/20' : 'bg-white/5'}`}>
              <MessageSquare
                size={24}
                className={smsEnabled ? 'text-cyan-400' : 'text-white/40'}
              />
            </div>
            <div>
              <p className={`font-medium text-lg ${smsEnabled ? 'text-white' : 'text-white/50'}`}>
                SMS Notifications
              </p>
              <p className="text-sm text-white/40">
                {smsEnabled
                  ? 'Players can opt in to receive SMS notifications'
                  : 'SMS features are hidden from players'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${
              smsEnabled ? 'bg-cyan-600' : 'bg-white/20'
            } ${saving ? 'opacity-50' : ''}`}
            role="switch"
            aria-checked={smsEnabled}
            aria-label="Toggle SMS notifications"
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                smsEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Status messages */}
        <div className="mt-4 h-6">
          {saving && <p className="text-white/40 text-sm">Saving...</p>}
          {saved && <p className="text-cyan-400 text-sm">Saved</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-white/80 font-medium mb-2">What this controls:</h3>
        <ul className="text-white/50 text-sm space-y-1.5 list-disc list-inside">
          <li>Phone number field on registration page</li>
          <li>SMS opt-in checkbox on registration page</li>
          <li>SMS notification settings on player profile page</li>
        </ul>
      </div>

      {/* Future features note */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
        <p className="text-amber-200 text-sm">
          SMS broadcast functionality is coming soon. Enable this setting now to start
          collecting phone numbers from players who opt in.
        </p>
      </div>
    </div>
  );
}
