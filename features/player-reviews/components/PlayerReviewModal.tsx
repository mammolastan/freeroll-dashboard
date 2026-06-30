'use client';
import React from 'react';
import { useSession } from 'next-auth/react';
import { usePlayerReviews } from '../hooks/usePlayerReviews';
import { RatingSummaryBar } from './RatingSummaryBar';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import { useLeaguePrefix } from '@/lib/LeagueContext';

interface PlayerReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewed_uid: string;
  player_name: string;
  league_id?: number;
}

export function PlayerReviewModal({
  isOpen,
  onClose,
  reviewed_uid,
  player_name,
  league_id = 1,
}: PlayerReviewModalProps) {
  const { data: session } = useSession();
  const viewer = session?.user;
  const viewer_uid = viewer?.uid ?? null;
  const isAdmin = viewer?.isAdmin === true;
  const leaguePrefix = useLeaguePrefix();

  const { data, loading, error, submitReview, deleteReview } = usePlayerReviews(
    isOpen ? reviewed_uid : null,
    league_id
  );

  if (!isOpen) return null;

  const canReview = !!viewer_uid && viewer_uid !== reviewed_uid;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white">{player_name}</h2>
            <p className="text-xs text-gray-400">Community Reviews</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading && <p className="text-gray-400 text-sm text-center py-8">Loading...</p>}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          {data && (
            <>
              {/* Summary */}
              <RatingSummaryBar summary={data.summary} />

              {/* Review form - for logged-in non-self viewers */}
              {canReview && (
                <ReviewForm
                  reviewed_uid={reviewed_uid}
                  existing={data.my_review}
                  onSubmit={submitReview}
                />
              )}
              {!viewer_uid && (
                <p className="text-sm text-gray-400 italic text-center border border-gray-700 rounded-lg p-3">
                  <a href={`${leaguePrefix}/login`} className="text-yellow-400 hover:underline">Log in</a> to leave a review.
                </p>
              )}

              {/* Review list */}
              {data.reviews.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                    All Reviews
                  </h4>
                  {data.reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      canDelete={isAdmin || review.reviewer_uid === viewer_uid}
                      onDelete={deleteReview}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
