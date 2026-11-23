// A member's membership status and balance, from their subscriptions (pure, safe
// for tests and the client). The database filters in membership-where.ts follow
// the same rules, so a member's badge always matches the list filter they're in.
import { summarizeBalance, type FeeBreakdown } from "@/lib/member-balance";
import { getDaysUntilExpiration } from "@/lib/date-utils";
import { EXPIRING_SOON_DAYS, expiryStatus } from "@/lib/dashboard";

export const MEMBER_STATUS_FILTERS = ["active", "expiring", "expired", "owing"] as const;
export type MemberStatusFilter = (typeof MEMBER_STATUS_FILTERS)[number];

export function parseMemberStatusFilter(value: unknown): MemberStatusFilter | null {
  return MEMBER_STATUS_FILTERS.includes(value as MemberStatusFilter) ? (value as MemberStatusFilter) : null;
}

export type MembershipState = "active" | "expiring" | "expired" | "frozen" | "none";

export type SubscriptionForStatus = FeeBreakdown & {
  id: string;
  billing_model: string;
  start_date: Date | string;
  end_date: Date | string;
  is_expired: boolean;
  frozen_since: Date | string | null;
  /** Sum of the subscription's payments. */
  paid: number;
};

export type MemberStatus = {
  state: MembershipState;
  /** "Active", "Expires in 3 days", "Expired 5 days ago", "Frozen", "No membership". */
  label: string;
  /** Days until the membership ends (negative once expired); null without one. */
  days: number | null;
  /** The current membership, or the latest one once it has ended. */
  subscription: SubscriptionForStatus | null;
  /** Unpaid across all the member's subscriptions. */
  balance: number;
};

const time = (d: Date | string) => new Date(d).getTime();

/**
 * Current = not expired and not past its end date, or frozen. The latest-ending
 * current membership decides the status, so a member who renewed early isn't
 * shown as expiring.
 */
export function memberStatus(subscriptions: SubscriptionForStatus[], now = new Date()): MemberStatus {
  const balance = subscriptions.reduce(
    (sum, s) => sum + summarizeBalance(s, [{ amount: s.paid }]).balance,
    0,
  );
  const byEndDesc = [...subscriptions].sort((a, b) => time(b.end_date) - time(a.end_date));
  const current = byEndDesc.filter(
    (s) => s.frozen_since || (!s.is_expired && getDaysUntilExpiration(new Date(s.end_date), now) >= 0),
  );

  if (current.length > 0) {
    const frozen = current.find((s) => s.frozen_since);
    if (frozen) return { state: "frozen", label: "Frozen", days: null, subscription: frozen, balance };
    const sub = current[0];
    const status = expiryStatus(sub.end_date, now);
    return status.days <= EXPIRING_SOON_DAYS
      ? { state: "expiring", label: status.label, days: status.days, subscription: sub, balance }
      : { state: "active", label: "Active", days: status.days, subscription: sub, balance };
  }

  const latest = byEndDesc[0];
  if (!latest) return { state: "none", label: "No membership", days: null, subscription: null, balance };
  const status = expiryStatus(latest.end_date, now);
  // Marked expired early (e.g. by the owner) but its end date hasn't passed yet.
  const label = status.days >= 0 ? "Expired" : status.label;
  return { state: "expired", label, days: status.days, subscription: latest, balance };
}
