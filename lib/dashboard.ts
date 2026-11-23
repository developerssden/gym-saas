// Pure calculations for the owner dashboard (safe for tests and the client).
import { summarizeBalance, type FeeBreakdown } from "@/lib/member-balance";
import { getDaysUntilExpiration, previousCalendarMonth } from "@/lib/date-utils";

/** Days ahead counted as "expiring soon" (today plus the next 7). */
export const EXPIRING_SOON_DAYS = 7;
/** Rows per "To do today" tab; counts are returned separately. */
export const ATTENTION_ROW_LIMIT = 8;
export const RECENT_PAYMENTS_LIMIT = 8;

export const CHART_RANGES = ["6m", "12m", "ytd"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export const CHART_RANGE_LABELS: Record<ChartRange, string> = {
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "This year",
};

export function parseChartRange(value: unknown): ChartRange {
  return CHART_RANGES.includes(value as ChartRange) ? (value as ChartRange) : "6m";
}

/** `YYYY-MM` keys for a chart range, oldest first, ending with `currentMonth`. */
export function chartMonths(range: ChartRange, currentMonth: string): string[] {
  const count = range === "6m" ? 6 : range === "12m" ? 12 : Number(currentMonth.slice(5, 7));
  const months = [currentMonth];
  while (months.length < count) months.unshift(previousCalendarMonth(months[0]));
  return months;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Nov", or "Nov 25" when the chart spans more than one year. */
export function monthLabel(month: string, withYear = false): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
  return withYear ? `${name} ${month.slice(2, 4)}` : name;
}

/** "November" for `2026-11`. */
export function longMonthName(month: string): string {
  return LONG_MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

/** Percent change from last month, or null when there's nothing to compare with. */
export function growthPct(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

export type ExpiryStatus = { days: number; label: string; tone: "due" | "expired" };

/** "Expires tomorrow", "Expired 5 days ago", … counted in the business time zone. */
export function expiryStatus(endDate: Date | string, now = new Date()): ExpiryStatus {
  const days = getDaysUntilExpiration(new Date(endDate), now);
  if (days > 1) return { days, label: `Expires in ${days} days`, tone: "due" };
  if (days === 1) return { days, label: "Expires tomorrow", tone: "due" };
  if (days === 0) return { days, label: "Expires today", tone: "due" };
  if (days === -1) return { days, label: "Expired yesterday", tone: "expired" };
  return { days, label: `Expired ${-days} days ago`, tone: "expired" };
}

const LAKH_CURRENCIES = new Set(["PKR", "INR", "NPR", "LKR", "BDT"]);

/** Short amount for chart labels: "4.1L", "1.2Cr", "45K" (lakh/crore for PKR and INR, else K/M/B). */
export function compactAmount(value: number, currencyCode = "PKR"): string {
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  const fmt = (v: number, unit: string) => `${sign}${Number(v.toFixed(v >= 10 ? 0 : 1))}${unit}`;
  if (LAKH_CURRENCIES.has(currencyCode)) {
    if (n >= 1e7) return fmt(n / 1e7, "Cr");
    if (n >= 1e5) return fmt(n / 1e5, "L");
  } else {
    if (n >= 1e9) return fmt(n / 1e9, "B");
    if (n >= 1e6) return fmt(n / 1e6, "M");
  }
  if (n >= 1e3) return fmt(n / 1e3, "K");
  return `${sign}${Math.round(n)}`;
}

export type SubscriptionFee = FeeBreakdown & { id: string; member_id: string };

/**
 * Unpaid balance per member across all their subscriptions (older renewed or
 * expired ones still count: that money is still owed). Largest first.
 * `paidBySubscription` is the sum of payments per subscription id.
 */
export function owingByMember(
  subscriptions: SubscriptionFee[],
  paidBySubscription: Map<string, number>,
): Array<{ memberId: string; balance: number; subscriptionId: string }> {
  const byMember = new Map<string, { balance: number; subscriptionId: string }>();
  for (const sub of subscriptions) {
    const { balance } = summarizeBalance(sub, [{ amount: paidBySubscription.get(sub.id) ?? 0 }]);
    if (balance <= 0) continue;
    const prev = byMember.get(sub.member_id);
    byMember.set(sub.member_id, {
      balance: (prev?.balance ?? 0) + balance,
      // Point "Record payment" at the subscription with the biggest balance.
      subscriptionId: prev && prev.balance >= balance ? prev.subscriptionId : sub.id,
    });
  }
  return [...byMember.entries()]
    .map(([memberId, v]) => ({ memberId, ...v }))
    .sort((a, b) => b.balance - a.balance);
}

/** First letters of the first two words: "Ali Khan" → "AK". */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}
