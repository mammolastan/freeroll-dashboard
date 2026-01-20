// app/admin/tournament-entry/screens/Screen5_TDMessages/TDMessagesScreen.tsx

'use client';

import React, { useState } from 'react';
import { Megaphone, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { TournamentFeed } from '@/components/TournamentFeed/TournamentFeed';

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
        setFeedback({ type: 'success', text: 'Message sent!' });
        setMessage('');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-cyan-300 mb-1 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
          Feed Management
        </h1>
        <p className="text-lg text-gray-400">
          {currentDraft.venue} - {new Date(currentDraft.tournament_date).toLocaleDateString()}
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Send TD Message */}
        <div>
          <div className="bg-gray-900/80 border-2 border-cyan-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-cyan-300">Send TD Message</h2>
                <p className="text-gray-400 text-xs">
                  Appears in the &quot;From the TD&quot; tab
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message to players..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-gray-800 border-2 border-cyan-500/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-500 resize-none"
                  disabled={isSubmitting}
                />
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-xs ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
                    {charCount} / {maxChars}
                  </span>
                  {isOverLimit && (
                    <span className="text-xs text-red-400">Too long</span>
                  )}
                </div>
              </div>

              {feedback && (
                <div className={`mb-3 p-2 rounded-lg flex items-center gap-2 text-sm ${
                  feedback.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                    : 'bg-red-500/20 border border-red-500/40 text-red-400'
                }`}>
                  {feedback.type === 'success' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !message.trim() || isOverLimit}
                className="w-full px-4 py-3 text-base font-bold bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send to Feed
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Tips */}
          <div className="mt-4 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Admin Tips</h3>
            <ul className="space-y-1 text-gray-400 text-xs">
              <li>• Hover over messages to reveal the delete button</li>
              <li>• Only user messages and TD messages can be deleted</li>
              <li>• Knockouts and check-ins cannot be removed</li>
            </ul>
          </div>
        </div>

        {/* Right Column - Feed with Admin Controls */}
        <div>
          <TournamentFeed
            tournamentId={currentDraft.id}
            maxHeight="calc(100vh - 220px)"
            showInput={false}
            isAdmin={true}
          />
        </div>
      </div>
    </div>
  );
}
