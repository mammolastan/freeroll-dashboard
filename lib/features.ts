// lib/features.ts
export const FEATURES = {
  PLAYER_REVIEWS: process.env.NEXT_PUBLIC_FEATURE_PLAYER_REVIEWS === 'true',
} as const;
