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
 * `YYYY-MM-DD` for the calendar day represented by `date` in `timeZone`.
 */
export function formatCalendarDate(
  date: Date,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date");
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `YYYY-MM-DD` calendar day (from an <input type="date">) to a Date at
 * 12:00 UTC, which falls on that same calendar day in every time zone from
 * UTC-11 to UTC+11 (including Asia/Karachi). Returns null if invalid.
 */
export function parseCalendarDay(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? date
    : null;
}

/** Minutes the time zone is ahead of UTC at `instant` (e.g. +300 for Asia/Karachi). */
function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The exact instants a calendar day starts and ends in `timeZone`, for range
 * queries: `{ gte: start, lt: end }`. `day` is `YYYY-MM-DD`. Null if invalid.
 */
export function calendarDayRange(
  day: string,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): { start: Date; end: Date } | null {
  const noon = parseCalendarDay(day);
  if (!noon) return null;
  const midnightUtc = Date.UTC(noon.getUTCFullYear(), noon.getUTCMonth(), noon.getUTCDate());
  return {
    start: localMidnight(midnightUtc, timeZone),
    end: localMidnight(midnightUtc + MS_PER_DAY, timeZone),
  };
}

/**
 * The instant local midnight happens in `timeZone` for the day whose UTC
 * midnight is `midnightUtc`. Two passes so the offset is the one in force at
 * midnight itself (matters on daylight-saving change days).
 */
function localMidnight(midnightUtc: number, timeZone: string): Date {
  const guess = midnightUtc - timeZoneOffsetMinutes(new Date(midnightUtc), timeZone) * 60_000;
  return new Date(midnightUtc - timeZoneOffsetMinutes(new Date(guess), timeZone) * 60_000);
}
