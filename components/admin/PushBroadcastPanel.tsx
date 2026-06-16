'use client';

import { useState, useEffect } from 'react';
import { Send, Bell, ChevronDown } from 'lucide-react';

interface Props {
  leagueSlug: string;
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

interface BroadcastResult {
  sent: number;
  failed: number;
  removed: number;
}

interface Subscriber {
  id: number;
  playerUid: string;
  name: string;
}

const MAX_LENGTH = 200;

export default function PushBroadcastPanel({ leagueSlug }: Props) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<SendStatus>('idle');
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<number | null>(null);
  const [loadingSubscribers, setLoadingSubscribers] = useState(true);

  useEffect(() => {
    async function fetchSubscribers() {
      try {
        const res = await fetch(`/api/${leagueSlug}/push/subscribers`);
        if (res.ok) {
          const data = await res.json();
          setSubscribers(data);
        }
      } catch (err) {
        console.error('[PushBroadcastPanel] Failed to fetch subscribers:', err);
      } finally {
        setLoadingSubscribers(false);
      }
    }
    fetchSubscribers();
  }, [leagueSlug]);

  async function handleSend() {
    if (!message.trim() || status === 'sending') return;

    setStatus('sending');
    setResult(null);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/${leagueSlug}/push/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, subscriberId: selectedSubscriberId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send');
      }

      setResult(data as BroadcastResult);
      setStatus('sent');
      setMessage('');
      setTimeout(() => setStatus('idle'), 6000);
    } catch (err) {
      console.error('[PushBroadcastPanel]', err);
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  }

  const remaining = MAX_LENGTH - message.length;
  const isOverLimit = remaining < 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Bell className="text-cyan-400" size={18} />
        <h2 className="text-base font-semibold text-white">Push Notification Broadcast</h2>
      </div>
      <p className="text-white/40 text-sm mb-5">
        Send a message to all players who have enabled notifications for this league.
      </p>

      {/* Target selector */}
      <div className="mb-4">
        <label className="block text-white/60 text-xs mb-1.5">Send to</label>
        <div className="relative">
          <select
            value={selectedSubscriberId ?? ''}
            onChange={(e) => setSelectedSubscriberId(e.target.value ? Number(e.target.value) : null)}
            className="w-full appearance-none bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors cursor-pointer"
            disabled={loadingSubscribers}
          >
            <option value="">All subscribers ({subscribers.length})</option>
            {subscribers.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your announcement here..."
        rows={3}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
      />

      {/* Footer row */}
      <div className="flex items-center justify-between mt-2">
        <span
          className={`text-xs transition-colors ${
            isOverLimit ? 'text-red-400' : remaining <= 30 ? 'text-yellow-400' : 'text-white/30'
          }`}
        >
          {remaining} characters remaining
        </span>

        <button
          onClick={handleSend}
          disabled={!message.trim() || isOverLimit || status === 'sending'}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Send size={14} />
          {status === 'sending' ? 'Sending...' : 'Send Push Notification'}
        </button>
      </div>

      {/* Result / error feedback */}
      {status === 'sent' && result && (
        <div className="mt-3 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
          Delivered to {result.sent} device{result.sent !== 1 ? 's' : ''}
          {result.removed > 0 &&
            ` · ${result.removed} stale subscription${result.removed !== 1 ? 's' : ''} cleaned up`}
          {result.failed > 0 && ` · ${result.failed} failed`}
        </div>
      )}
      {status === 'error' && (
        <div className="mt-3 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          Failed to send: {errorMsg}
        </div>
      )}
    </div>
  );
}
