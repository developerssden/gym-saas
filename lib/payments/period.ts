// Date filters for the payments list (pure, safe for tests).
// Ranges are worked out on the device, so "today" is the gym's own day.
import { addDays, isValid, parse, startOfDay, startOfMonth, startOfWeek } from "date-fns";

export type PaymentPeriod = "today" | "week" | "month" | "all" | "custom";

export const PAYMENT_PERIODS: Array<{ id: PaymentPeriod; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
  { id: "custom", label: "Pick dates" },
];

/** What the total is for, e.g. "Collected today". */
export const PERIOD_TOTAL_LABEL: Record<PaymentPeriod, string> = {
  today: "Collected today",
  week: "Collected this week",
  month: "Collected this month",
  all: "Collected in total",
  custom: "Collected in these dates",
};

/** `from` is the first moment included, `to` the first moment after the range. */
export type DateRange = { from?: Date; to?: Date };

const parseDay = (value: string | undefined) => {
  if (!value) return undefined;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return isValid(d) ? startOfDay(d) : undefined;
};

/**
 * The range for a period. Weeks start on Monday. Custom dates are whole days
 * ("yyyy-MM-dd", as a date input gives them), both ends included; swapped
 * dates are put in order.
 */
export function periodRange(
  period: PaymentPeriod,
  now: Date = new Date(),
  custom: { from?: string; to?: string } = {}
): DateRange {
  const today = startOfDay(now);
  switch (period) {
    case "today":
      return { from: today, to: addDays(today, 1) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: addDays(today, 1) };
    case "month":
      return { from: startOfMonth(now), to: addDays(today, 1) };
    case "custom": {
      let from = parseDay(custom.from);
      let to = parseDay(custom.to);
      if (from && to && from > to) [from, to] = [to, from];
      return { from, to: to ? addDays(to, 1) : undefined };
    }
    default:
      return {};
  }
}
