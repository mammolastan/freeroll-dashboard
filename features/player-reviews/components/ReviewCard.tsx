'use client';
import Image from 'next/image';
import { StarRating } from './StarRating';
import { TagBubbles } from './TagBubbles';
import type { PlayerReview } from '../types';

interface ReviewCardProps {
  review: PlayerReview;
  canDelete: boolean; // true if viewer is owner or admin
  onDelete: (id: number) => void;
}

export function ReviewCard({ review, canDelete, onDelete }: ReviewCardProps) {
  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {review.reviewer_photo_url ? (
            <Image
              src={review.reviewer_photo_url}
              alt={review.reviewer_name}
              width={32} height={32}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-300">
              {review.reviewer_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-white">{review.reviewer_name}</div>
            <div className="text-xs text-gray-400">{date}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarRating value={review.rating} size="sm" />
          {canDelete && (
            <button
              onClick={() => onDelete(review.id)}
              className="text-gray-500 hover:text-red-400 transition-colors text-xs ml-2"
              title="Delete review"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {/* Tags */}
      {review.tags.length > 0 && (
        <TagBubbles selected={review.tags} onChange={() => {}} readOnly />
      )}
      {/* Text */}
      {review.review_text && (
        <p className="text-sm text-gray-300 leading-relaxed">{review.review_text}</p>
      )}
    </div>
  );
}
