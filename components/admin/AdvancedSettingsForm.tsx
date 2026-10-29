'use client';

import { useState } from 'react';
import { Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  leagueSlug: string;
}

export default function AdvancedSettingsForm({ leagueSlug }: Props) {
  const [invalidating, setInvalidating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleInvalidateCache() {
    if (!confirm('Are you sure you want to invalidate all caches for this league? This will cause the next page loads to fetch fresh data from the database.')) {
      return;
    }

    setInvalidating(true);
    setResult(null);

    try {
      const res = await fetch(`/api/${leagueSlug}/admin/cache`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to invalidate cache');
      }

      setResult({
        success: true,
        message: `Cache invalidated successfully at ${new Date(data.invalidatedAt).toLocaleTimeString()}`,
      });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to invalidate cache',
      });
    } finally {
      setInvalidating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Cache Invalidation Section */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Cache Management</h3>
        <p className="text-white/60 text-sm mb-4">
          Rankings, leaderboards, and recent games are cached for performance.
          Caches are automatically invalidated when tournaments are finalized or edited.
          Use this button to manually clear all caches if you&apos;ve made direct database changes.
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={handleInvalidateCache}
            disabled={invalidating}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {invalidating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            {invalidating ? 'Invalidating...' : 'Invalidate All Caches'}
          </button>

          {result && (
            <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {result.message}
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-amber-400 text-xs">
            <strong>Note:</strong> Invalidating caches will cause the next page loads to be slower
            as fresh data is fetched from the database. This is normal and subsequent loads will be fast again.
          </p>
        </div>
      </section>

      {/* Cache Info Section */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">What Gets Cached</h3>
        <ul className="text-white/60 text-sm space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span><strong className="text-white/80">Rankings</strong> — Quarterly, monthly, and custom period rankings</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span><strong className="text-white/80">Leaderboard</strong> — Advanced stats with date/venue filters</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span><strong className="text-white/80">Recent Games</strong> — The games listing page</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
