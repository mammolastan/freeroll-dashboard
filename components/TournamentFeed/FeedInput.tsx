// components/TournamentFeed/FeedInput.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';

interface FeedInputProps {
  onSubmit: (message: string) => Promise<{ success: boolean; error?: string }>;
  posting: boolean;
  canPost: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function FeedInput({
  onSubmit,
  posting,
  canPost,
  placeholder = 'Say something...',
  maxLength = 500,
}: FeedInputProps) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || posting) return;

    setError(null);
    const result = await onSubmit(message);

    if (result.success) {
      setMessage('');
      inputRef.current?.focus();
    } else {
      setError(result.error || 'Failed to post message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Not authenticated - show login prompt
  if (!canPost) {
    return (
      <div className="px-4 py-3 bg-gray-900/30">
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-cyan-500/50 rounded-lg text-gray-400 hover:text-cyan-300 transition-all text-sm"
        >
          <LogIn className="h-4 w-4" />
          <span>Log in to post messages</span>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 bg-gray-900/30">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={posting}
            className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 focus:border-cyan-500/50 rounded-lg text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50 transition-colors"
          />
          
          {/* Character count (only show when approaching limit) */}
          {message.length > maxLength - 50 && (
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
              message.length >= maxLength ? 'text-red-400' : 'text-gray-500'
            }`}>
              {message.length}/{maxLength}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!message.trim() || posting}
          className="flex-shrink-0 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:shadow-none"
        >
          {posting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-2 text-xs text-red-400 animate-pulse">
          {error}
        </p>
      )}
    </form>
  );
}