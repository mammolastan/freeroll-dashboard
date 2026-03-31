'use client';
import { REVIEW_TAGS } from '../types';

interface TagBubblesProps {
  selected: string[];
  onChange: (tags: string[]) => void;
  readOnly?: boolean;
}

export function TagBubbles({ selected, onChange, readOnly = false }: TagBubblesProps) {
  const toggle = (label: string) => {
    if (readOnly) return;
    onChange(
      selected.includes(label)
        ? selected.filter((t) => t !== label)
        : [...selected, label]
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {REVIEW_TAGS.map(({ emoji, label }) => {
        const active = selected.includes(label);
        return (
          <button
            key={label}
            type="button"
            disabled={readOnly}
            onClick={() => toggle(label)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              readOnly ? 'cursor-default' : 'cursor-pointer'
            } ${
              active
                ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                : 'bg-transparent border-gray-600 text-gray-300 hover:border-yellow-400 hover:text-yellow-400'
            }`}
          >
            {emoji} {label}
          </button>
        );
      })}
    </div>
  );
}
