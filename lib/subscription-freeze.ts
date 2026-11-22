import {
  DEFAULT_BUSINESS_TIME_ZONE,
  MS_PER_DAY,
  getCalendarDayOrdinal,
  parseCalendarDay,
} from "@/lib/date-utils";

/**
 * Freezing (pausing) a Member Subscription.
 *
 * A freeze starts on a calendar day and ends on the day the member is back.
 * The days in between are added to the subscription's end date, so
 * frozen Mon → back Thu = 3 days added. Days are counted in the business
 * time zone, like the rest of the subscription lifecycle.
 */

export { parseCalendarDay };

type FreezeCandidate = {
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  is_expired: boolean;
  is_deleted?: boolean;
  frozen_since: Date | null;
};

/** Returns a user-facing error, or null when the subscription can be frozen from `freezeStart`. */
export function validateFreezeStart(
  subscription: FreezeCandidate,
  freezeStart: Date,
  now = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): string | null {
  if (subscription.is_deleted) return "Subscription not found";
  if (subscription.frozen_since) return "This subscription is already frozen";
  if (!subscription.is_active || subscription.is_expired) {
    return "Only active subscriptions can be frozen";
  }

  const day = (d: Date) => getCalendarDayOrdinal(new Date(d), timeZone);
  const start = day(freezeStart);
  if (start > day(now)) return "A freeze can't start in the future";
  if (start < day(subscription.start_date)) {
    return "A freeze can't start before the subscription started";
  }
  if (start >= day(subscription.end_date)) {
    return "A freeze must start before the subscription ends";
  }
  return null;
}

export type UnfreezeResult =
  | { ok: true; days: number; newEndDate: Date }
  | { ok: false; error: string };

/**
 * Works out how far to push the end date when a member comes back on `backOn`.
 * `backOn` is the first day they're active again (may be today or earlier).
 */
export function computeUnfreeze(
  subscription: { end_date: Date; frozen_since: Date | null },
  backOn: Date,
  now = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): UnfreezeResult {
  if (!subscription.frozen_since) {
    return { ok: false, error: "This subscription isn't frozen" };
  }

  const day = (d: Date) => getCalendarDayOrdinal(new Date(d), timeZone);
  const back = day(backOn);
  const frozenFrom = day(subscription.frozen_since);
  if (back < frozenFrom) {
    return { ok: false, error: "The return date can't be before the freeze started" };
  }
  if (back > day(now)) {
    return { ok: false, error: "The return date can't be in the future" };
  }

  const days = back - frozenFrom;
  const end = new Date(subscription.end_date);
  return { ok: true, days, newEndDate: new Date(end.getTime() + days * MS_PER_DAY) };
}
