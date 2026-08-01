export const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const DEFAULT_BUSINESS_TIME_ZONE =
  process.env.APP_TIME_ZONE || "Asia/Karachi";

/**
 * Returns a stable UTC ordinal for the calendar day represented by `date`
 * in `timeZone`. Comparing ordinals avoids DST-length day drift.
 */
export function getCalendarDayOrdinal(
  date: Date,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): number {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return Math.floor(
    Date.UTC(values.year, values.month - 1, values.day) / MS_PER_DAY
  );
}

/**
 * Days until endDate from a reference date in the business timezone.
 * Negative = already expired.
 * Zero = expires today.
 */
export function getDaysUntilExpiration(
  endDate: Date,
  referenceDate = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): number {
  return (
    getCalendarDayOrdinal(new Date(endDate), timeZone) -
    getCalendarDayOrdinal(new Date(referenceDate), timeZone)
  );
}

/**
 * True if end_date is today or in the past in the business timezone.
 */
export function isExpiredOrToday(
  endDate: Date,
  referenceDate = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): boolean {
  return getDaysUntilExpiration(endDate, referenceDate, timeZone) <= 0;
}
