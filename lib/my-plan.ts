// The owner's Subscription page: plan status and how much of each limit is
// used. Pure (tested); the API route loads the data.

export type PlanLimits = {
  max_gyms: number;
  max_locations: number;
  max_members: number;
  max_equipment: number;
  max_staff: number;
};

export type PlanStatus =
  | { kind: "active"; daysLeft: number; endsOn: string }
  | { kind: "expiring"; daysLeft: number; endsOn: string }
  | { kind: "expired"; endedOn: string }
  | { kind: "none" };

/** Days left counted in whole days; "expiring" within this many days. */
export const EXPIRING_SOON_DAYS = 7;

export function planStatus(
  subscription: { end_date: Date | string; is_active: boolean; is_expired: boolean } | null,
  now = new Date()
): PlanStatus {
  if (!subscription) return { kind: "none" };
  const end = new Date(subscription.end_date);
  const endsOn = end.toISOString();
  if (!subscription.is_active || subscription.is_expired || end.getTime() <= now.getTime()) {
    return { kind: "expired", endedOn: endsOn };
  }
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return daysLeft <= EXPIRING_SOON_DAYS ? { kind: "expiring", daysLeft, endsOn } : { kind: "active", daysLeft, endsOn };
}

export type UsageState = "ok" | "near" | "full" | "notIncluded";

export type UsageRow = {
  label: string;
  used: number;
  max: number;
  state: UsageState;
};

export type UsageItem = {
  key: "gyms" | "locations" | "staff" | "members" | "equipment";
  label: string;
  /** What the limit means, e.g. "per branch". */
  hint?: string;
  /** One row for account-wide limits, one per branch for per-branch limits. */
  rows: UsageRow[];
};

export function usageState(used: number, max: number): UsageState {
  if (max <= 0) return "notIncluded";
  if (used >= max) return "full";
  // Within 10% (or the last one) of the limit.
  if (used >= Math.max(1, Math.min(max - 1, Math.ceil(max * 0.9)))) return "near";
  return "ok";
}

export function buildPlanUsage(
  limits: PlanLimits,
  counts: { gyms: number; locations: number; staff: number },
  branches: Array<{ name: string; members: number; equipment: number }>
): UsageItem[] {
  const row = (label: string, used: number, max: number): UsageRow => ({ label, used, max, state: usageState(used, max) });
  const perBranch = (pick: (b: (typeof branches)[number]) => number, max: number) =>
    branches.length > 0 ? branches.map(b => row(b.name, pick(b), max)) : [row("No branches yet", 0, max)];

  return [
    { key: "gyms", label: "Gyms", rows: [row("Gyms", counts.gyms, limits.max_gyms)] },
    { key: "locations", label: "Branches", hint: "Locations across all your gyms", rows: [row("Branches", counts.locations, limits.max_locations)] },
    { key: "staff", label: "Staff logins", hint: "Active staff and pending invites", rows: [row("Staff logins", counts.staff, limits.max_staff)] },
    { key: "members", label: "Members", hint: "Per branch", rows: perBranch(b => b.members, limits.max_members) },
    { key: "equipment", label: "Equipment", hint: "Per branch", rows: perBranch(b => b.equipment, limits.max_equipment) },
  ];
}

/** Things every plan includes (from the pricing page), plus the plan's own limits in words. */
export function planFeatures(limits: PlanLimits): string[] {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return [
    `Up to ${n(limits.max_gyms, "gym", "gyms")} and ${n(limits.max_locations, "branch", "branches")}`,
    `${n(limits.max_members, "member", "members")} per branch`,
    `${n(limits.max_equipment, "equipment item", "equipment items")} per branch`,
    limits.max_staff > 0 ? `${n(limits.max_staff, "staff login", "staff logins")} with their own permissions` : "No staff logins",
    "Fee reminders and expiry alerts",
    "WhatsApp reminders and receipts",
    "PDF invoices, monthly reports and cash book",
  ];
}
