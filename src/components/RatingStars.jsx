import React from 'react';
import { Star } from 'lucide-react';

/**
 * RatingStars — visual star selector / display.
 *
 * Props:
 *   value    {number}   — current rating (0–5)
 *   onChange {function} — called with new value; omit for readonly
 *   size     {'sm'|'md'|'lg'} — icon size (default 'md')
 *   readonly {boolean}  — disable interaction
 */
export default function RatingStars({ value = 0, onChange, size = 'md', readonly = false }) {
  const sz = size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          className={`transition-transform ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          aria-label={`${star} estrella${star !== 1 ? 's' : ''}`}
        >
          <Star
            className={`${sz} transition-colors ${
              star <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
