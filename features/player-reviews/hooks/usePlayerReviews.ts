import { useState, useEffect, useCallback } from 'react';
import type { ReviewsApiResponse, CreateReviewPayload } from '../types';

export function usePlayerReviews(reviewed_uid: string | null, league_id = 1) {
  const [data, setData] = useState<ReviewsApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!reviewed_uid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/player-reviews?reviewed_uid=${reviewed_uid}&league_id=${league_id}`
      );
      if (!res.ok) throw new Error('Failed to load reviews');
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [reviewed_uid, league_id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const submitReview = async (payload: CreateReviewPayload): Promise<boolean> => {
    try {
      const res = await fetch('/api/player-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, league_id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to submit');
      }
      await fetchReviews(); // refresh after submit
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    }
  };

  const deleteReview = async (reviewId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/player-reviews/${reviewId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchReviews();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    }
  };

  return { data, loading, error, refetch: fetchReviews, submitReview, deleteReview };
}
