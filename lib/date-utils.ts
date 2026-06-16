export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Normalizes a date to midnight local time.
 * Always use this before date comparisons to avoid hour-of-day drift.
 */
export function toMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Days until endDate from today (midnight-normalized).
 * Negative = already expired.
 * Zero = expires today.
 */
export function getDaysUntilExpiration(endDate: Date): number {
  const today = toMidnight(new Date());
  const end = toMidnight(new Date(endDate));
  return Math.ceil((end.getTime() - today.getTime()) / MS_PER_DAY);
}

/**
 * True if end_date is today or in the past (midnight-normalized).
 */
export function isExpiredOrToday(endDate: Date): boolean {
  return getDaysUntilExpiration(endDate) <= 0;
}
