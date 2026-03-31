export interface PlayerReview {
  id: number;
  league_id: number;
  reviewed_uid: string;
  reviewer_uid: string;
  reviewer_name: string;       // joined from players table
  reviewer_photo_url?: string; // joined from players table
  rating: number;              // 1-5
  review_text: string | null;
  tags: string[];              // parsed from comma-separated DB string
  created_at: string;
  updated_at: string;
}

export interface ReviewSummary {
  average_rating: number;      // e.g. 4.2
  total_reviews: number;
  rating_distribution: Record<1 | 2 | 3 | 4 | 5, number>; // count per star level
}

export interface CreateReviewPayload {
  reviewed_uid: string;
  rating: number;
  review_text?: string;
  tags?: string[];
}

export interface ReviewsApiResponse {
  reviews: PlayerReview[];
  summary: ReviewSummary;
  my_review: PlayerReview | null; // the current user's review, if any
}

// Tags config - add new tags here as needed
export const REVIEW_TAGS: { label: string; emoji: string }[] = [
  { emoji: '🤝', label: 'Good Sport' },
  { emoji: '🃏', label: 'Sharp Player' },
  { emoji: '😂', label: 'Table Talk King' },
  { emoji: '🎯', label: 'Consistent' },
  { emoji: '🧠', label: 'Strategic' },
  { emoji: '⚡', label: 'Quick Decisions' },
  { emoji: '🎉', label: 'Fun to Play With' },
  { emoji: '🫡', label: 'Respectful' },
  { emoji: '🚫', label: 'Rabbit-chases too much' },
  { emoji: '☠️', label: 'Is table poison' },
  { emoji: '🫟', label: 'Spilled my drink' },
  { emoji: '👃', label: 'Smells' },
];
// To add more tags: append to this array. No DB changes needed.
