'use client';

import { StarIcon } from './icons';
import { cx } from './ui';

export function ratingAverage(sum: number, count: number) {
  return count > 0 ? sum / count : 0;
}

/** Read-only stars, rounded to the nearest half (shown as a full star from .5 up). */
export function Stars({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const filled = Math.round(value);
  return (
    <span
      className={cx('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${value.toFixed(1)} / 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          size={size}
          className={n <= filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
        />
      ))}
    </span>
  );
}

/** "★★★★☆ 4.3 (12)"; renders nothing until a product has its first review. */
export function RatingSummary({
  sum,
  count,
  size,
  className,
}: {
  sum: number;
  count: number;
  size?: number;
  className?: string;
}) {
  if (count === 0) return null;
  const avg = ratingAverage(sum, count);
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs text-slate-500', className)}>
      <Stars value={avg} size={size} />
      <span className="font-semibold text-navy-900">{avg.toFixed(1)}</span>({count})
    </span>
  );
}

/** Five tappable stars for choosing a rating. */
export function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (rating: number) => void;
  label: string;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} / 5`}
          onClick={() => onChange(n)}
          className="rounded-lg p-1 transition hover:bg-amber-50"
        >
          <StarIcon
            size={28}
            className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
          />
        </button>
      ))}
    </div>
  );
}
