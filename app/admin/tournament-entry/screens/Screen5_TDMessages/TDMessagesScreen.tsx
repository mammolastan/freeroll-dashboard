// app/admin/tournament-entry/screens/Screen5_TDMessages/TDMessagesScreen.tsx

'use client';

import React, { useState } from 'react';
import { Megaphone, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface TournamentDraft {
  id: number;
  tournament_date: string;
  director_name: string;
  venue: string;
  start_points: number;
  status: 'in_progress' | 'finalized' | 'integrated';
  created_at: string;
  updated_at: string;
  player_count: number;
  blind_schedule?: string;
}

interface TDMessagesScreenProps {
  currentDraft: TournamentDraft | null;
}

export function TDMessagesScreen({ currentDraft }: TDMessagesScreenProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentDraft || !message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/tournament-drafts/${currentDraft.id}/td-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', text: 'Message sent to feed!' });
        setMessage('');
        // Clear success message after 3 seconds
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to send message' });
      }
    } catch (error) {
      console.error('Error sending TD message:', error);
      setFeedback({ type: 'error', text: 'Failed to send message. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const charCount = message.length;
  const maxChars = 500;
  const isOverLimit = charCount > maxChars;

  if (!currentDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cyan-300 mb-4">No Active Tournament</h1>
          <p className="text-gray-400 text-lg">
            Please create or select a tournament on Screen 1 (Full Admin)
          </p>
          <div className="mt-8 text-sm text-gray-500">
            Press 1 to go to Full Admin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-cyan-300 mb-2 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
          TD Messages
        </h1>
        <p className="text-xl text-gray-400">
          {currentDraft.venue} - {new Date(currentDraft.tournament_date).toLocaleDateString()}
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto">
        {/* Message Form Card */}
        <div className="bg-gray-900/80 border-2 border-cyan-500/30 rounded-xl p-8 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Megaphone className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-cyan-300">Send Message to Feed</h2>
              <p className="text-gray-400 text-sm">
                This message will appear in the &quot;From the TD&quot; tab for all players
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message to players..."
                rows={4}
                className="w-full px-4 py-3 text-lg bg-gray-800 border-2 border-cyan-500/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500 resize-none"
                disabled={isSubmitting}
              />
              <div className="flex justify-between items-center mt-2">
                <span className={`text-sm ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
                  {charCount} / {maxChars}
                </span>
                {isOverLimit && (
                  <span className="text-sm text-red-400">
                    Message is too long
                  </span>
                )}
              </div>
            </div>

            {/* Feedback Message */}
            {feedback && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                  : 'bg-red-500/20 border border-red-500/40 text-red-400'
              }`}>
                {feedback.type === 'success' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !message.trim() || isOverLimit}
              className="w-full px-6 py-4 text-xl font-bold bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-6 w-6" />
                  Send to Feed
                </>
              )}
            </button>
          </form>
        </div>

        {/* Tips Card */}
        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Tips for TD Messages</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">•</span>
              <span>Use for important announcements like break times, blind changes, or special rules</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">•</span>
              <span>Messages appear instantly in the &quot;From the TD&quot; tab on the game view</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">•</span>
              <span>Keep messages clear and concise for maximum impact</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
