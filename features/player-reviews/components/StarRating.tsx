'use client';
import React from 'react';

interface StarRatingProps {
  value: number;          // current rating (1-5)
  onChange?: (v: number) => void; // if omitted, renders read-only
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const [hovered, setHovered] = React.useState(0);
  const sizes = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' };
  const isInteractive = !!onChange;

  return (
    <div className="flex gap-0.5" role={isInteractive ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!isInteractive}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => isInteractive && setHovered(star)}
          onMouseLeave={() => isInteractive && setHovered(0)}
          className={`${sizes[size]} transition-transform ${
            isInteractive ? 'cursor-pointer hover:scale-110' : 'cursor-default'
          } ${!isInteractive ? 'pointer-events-none' : ''}`}
          aria-label={isInteractive ? `Rate ${star} star${star > 1 ? 's' : ''}` : undefined}
        >
          <span className={
            (hovered || value) >= star ? 'text-yellow-400' : 'text-gray-600'
          }>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}
