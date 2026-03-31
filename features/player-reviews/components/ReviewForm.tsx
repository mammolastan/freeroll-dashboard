'use client';
import React, { useState, useEffect } from 'react';
import { StarRating } from './StarRating';
import { REVIEW_TAGS } from '../types';
import type { PlayerReview, CreateReviewPayload } from '../types';

interface ReviewFormProps {
  reviewed_uid: string;
  existing: PlayerReview | null; // pre-fill if editing
  onSubmit: (payload: CreateReviewPayload) => Promise<boolean>;
}

export function ReviewForm({ reviewed_uid, existing, onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.review_text ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync if existing review loads after mount
  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setText(existing.review_text ?? '');
    }
  }, [existing?.id]);

  const handleTagClick = (emoji: string, label: string) => {
    const tagText = `${emoji} ${label}`;
    // Append tag to text, with space/newline separator if needed
    setText((prev) => {
      if (!prev.trim()) return tagText;
      // If already contains this tag, don't add again
      if (prev.includes(tagText)) return prev;
      return prev + ' ' + tagText;
    });
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    const ok = await onSubmit({ reviewed_uid, rating, review_text: text, tags: [] });
    setSubmitting(false);
    if (ok) setSuccess(true);
  };

  if (success) {
    return (
      <div className="text-center py-4 text-green-400 font-medium">
        Review {existing ? 'updated' : 'submitted'}!
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-gray-700 pt-4">
      <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        {existing ? 'Update Your Review' : 'Leave a Review'}
      </h4>
      {/* Stars */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Your Rating *</label>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>
      {/* Quick Tags - clicking appends to text */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block">Quick Tags (click to add)</label>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map(({ emoji, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleTagClick(emoji, label)}
              className="px-3 py-1 rounded-full text-xs font-medium border cursor-pointer
                         bg-transparent border-gray-600 text-gray-300
                         hover:border-yellow-400 hover:text-yellow-400 transition-all"
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>
      {/* Text */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Comment (optional)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Say something about this player..."
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 resize-none"
        />
        <div className="text-right text-xs text-gray-500 mt-0.5">{text.length}/500</div>
      </div>
      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        style={{ backgroundColor: '#facc15', color: '#111827' }}
        className="w-full py-3 font-bold rounded-lg text-sm
                   hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? 'Saving...' : existing ? 'Update Review' : 'Submit Review'}
      </button>
    </div>
  );
}
