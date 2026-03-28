'use client';
import { StarRating } from './StarRating';
import type { ReviewSummary } from '../types';

export function RatingSummaryBar({ summary }: { summary: ReviewSummary }) {
  const { average_rating, total_reviews, rating_distribution } = summary;

  if (total_reviews === 0) {
    return <p className="text-sm text-gray-400 italic">No reviews yet. Be the first!</p>;
  }

  return (
    <div className="flex gap-6 items-center mb-4">
      {/* Big number */}
      <div className="text-center min-w-[60px]">
        <div className="text-4xl font-bold text-white">{average_rating.toFixed(1)}</div>
        <StarRating value={Math.round(average_rating)} size="sm" />
        <div className="text-xs text-gray-400 mt-1">{total_reviews} review{total_reviews !== 1 ? 's' : ''}</div>
      </div>
      {/* Distribution bars */}
      <div className="flex-1 space-y-1">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = rating_distribution[star] ?? 0;
          const pct = total_reviews > 0 ? (count / total_reviews) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-4 text-right">{star}</span>
              <span className="text-yellow-400 text-xs">★</span>
              <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-yellow-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-4">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
