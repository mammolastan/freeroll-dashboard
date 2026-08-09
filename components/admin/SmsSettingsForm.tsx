'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, ChevronDown } from 'lucide-react';

interface Props {
  leagueSlug: string;
  initialSmsEnabled: boolean;
}

interface Recipient {
  id: number;
  playerUid: string;
  name: string;
}

export default function SmsSettingsForm({ leagueSlug, initialSmsEnabled }: Props) {
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Broadcast state
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Fetch recipients when SMS is enabled
  useEffect(() => {
    if (smsEnabled) {
      setLoadingRecipients(true);
      fetch(`/api/${leagueSlug}/admin/sms/recipients`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.recipients) {
            setRecipients(data.recipients);
          }
        })
        .catch(() => setRecipients([]))
        .finally(() => setLoadingRecipients(false));
    }
  }, [smsEnabled, leagueSlug]);

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

  async function handleSendBroadcast() {
    if (!message.trim()) return;

    const selectedPlayer = selectedPlayerId
      ? recipients.find((r) => r.id === selectedPlayerId)
      : null;

    const targetDescription = selectedPlayer
      ? selectedPlayer.name
      : `${recipients.length} players`;

    const confirmed = window.confirm(
      `Send this message to ${targetDescription}?\n\n"${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`
    );

    if (!confirmed) return;

    setSending(true);
    setBroadcastResult(null);
    setBroadcastError(null);

    try {
      const res = await fetch(`/api/${leagueSlug}/admin/sms/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          playerId: selectedPlayerId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send broadcast');
      }

      setBroadcastResult(data);
      if (data.sent > 0) {
        setMessage('');
      }
    } catch (err) {
      setBroadcastError(err instanceof Error ? err.message : 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  }

  const recipientCount = recipients.length;

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

      {/* Broadcast Section - only shown when SMS is enabled */}
      {smsEnabled && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <Send size={18} className="text-cyan-400" />
            Send SMS
          </h3>

          {/* Target selector */}
          <div className="mb-4">
            <label className="block text-white/60 text-xs mb-1.5">Send to</label>
            <div className="relative">
              <select
                value={selectedPlayerId ?? ''}
                onChange={(e) => setSelectedPlayerId(e.target.value ? Number(e.target.value) : null)}
                className="w-full appearance-none bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors cursor-pointer"
                disabled={loadingRecipients || sending}
              >
                <option value="">All opted-in players ({recipientCount})</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
            </div>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={selectedPlayerId ? 'Type your message...' : 'Type your message to all opted-in players...'}
            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-cyan-500/50"
            rows={4}
            maxLength={1600}
            disabled={sending}
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-white/40 text-sm">
              {message.length}/1600 characters
            </span>

            <button
              onClick={handleSendBroadcast}
              disabled={!message.trim() || sending || (recipientCount === 0 && !selectedPlayerId)}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {sending ? (
                'Sending...'
              ) : (
                <>
                  <Send size={16} />
                  Send SMS
                </>
              )}
            </button>
          </div>

          {/* Broadcast result */}
          {broadcastResult && (
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <p className="text-cyan-400 text-sm">
                {broadcastResult.total === 1
                  ? 'Message sent successfully'
                  : `Successfully sent to ${broadcastResult.sent} of ${broadcastResult.total} players`}
                {broadcastResult.failed > 0 && (
                  <span className="text-amber-400"> ({broadcastResult.failed} failed)</span>
                )}
              </p>
            </div>
          )}

          {/* Broadcast error */}
          {broadcastError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{broadcastError}</p>
            </div>
          )}

          {/* No recipients warning */}
          {recipientCount === 0 && !loadingRecipients && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-200 text-sm">
                No players have opted in to SMS notifications yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-white/80 font-medium mb-2">What this controls:</h3>
        <ul className="text-white/50 text-sm space-y-1.5 list-disc list-inside">
          <li>Phone number field on registration page</li>
          <li>SMS opt-in checkbox on registration page</li>
          <li>SMS notification settings on player profile page</li>
        </ul>
      </div>
    </div>
  );
}
