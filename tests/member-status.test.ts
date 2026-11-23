import assert from "node:assert/strict";
import test from "node:test";
import { memberStatus, parseMemberStatusFilter, type SubscriptionForStatus } from "@/lib/members/member-status";

// 10:00 Karachi on 22 Nov 2026.
const now = new Date("2026-11-22T05:00:00Z");

const sub = (over: Partial<SubscriptionForStatus>): SubscriptionForStatus => ({
  id: "s1",
  price: 5000,
  billing_model: "MONTHLY",
  start_date: "2026-11-01T12:00:00Z",
  end_date: "2026-12-20T12:00:00Z",
  is_expired: false,
  frozen_since: null,
  paid: 5000,
  ...over,
});

test("no subscriptions: no membership", () => {
  const s = memberStatus([], now);
  assert.equal(s.state, "none");
  assert.equal(s.label, "No membership");
  assert.equal(s.balance, 0);
});

test("a membership ending later than a week is active", () => {
  const s = memberStatus([sub({})], now);
  assert.equal(s.state, "active");
  assert.equal(s.label, "Active");
  assert.equal(s.days, 28);
});

test("ending within 7 days is expiring, today included", () => {
  assert.equal(memberStatus([sub({ end_date: "2026-11-25T12:00:00Z" })], now).label, "Expires in 3 days");
  assert.equal(memberStatus([sub({ end_date: "2026-11-22T12:00:00Z" })], now).state, "expiring");
  assert.equal(memberStatus([sub({ end_date: "2026-11-29T12:00:00Z" })], now).state, "expiring");
  assert.equal(memberStatus([sub({ end_date: "2026-11-30T12:00:00Z" })], now).state, "active");
});

test("an early renewal wins over the expiring membership", () => {
  const s = memberStatus(
    [sub({ id: "old", end_date: "2026-11-24T12:00:00Z" }), sub({ id: "new", end_date: "2026-12-24T12:00:00Z" })],
    now,
  );
  assert.equal(s.state, "active");
  assert.equal(s.subscription?.id, "new");
});

test("past the end date is expired even before the nightly job flags it", () => {
  const s = memberStatus([sub({ end_date: "2026-11-17T12:00:00Z", is_expired: false })], now);
  assert.equal(s.state, "expired");
  assert.equal(s.label, "Expired 5 days ago");
  const flaggedEarly = memberStatus([sub({ end_date: "2026-11-30T12:00:00Z", is_expired: true })], now);
  assert.equal(flaggedEarly.state, "expired");
  assert.equal(flaggedEarly.label, "Expired");
});

test("frozen counts as current, even past its end date", () => {
  const s = memberStatus([sub({ end_date: "2026-11-10T12:00:00Z", frozen_since: "2026-11-05T12:00:00Z" })], now);
  assert.equal(s.state, "frozen");
});

test("balance adds up every subscription, including old ones", () => {
  const s = memberStatus(
    [
      sub({ id: "old", end_date: "2026-10-31T12:00:00Z", is_expired: true, paid: 3000 }), // owes 2000
      sub({ id: "new", price: 6000, admission_fee: 1000, discount: 500, paid: 4000 }), // owes 2500
    ],
    now,
  );
  assert.equal(s.state, "active");
  assert.equal(s.balance, 4500);
});

test("status filter parsing", () => {
  assert.equal(parseMemberStatusFilter("owing"), "owing");
  assert.equal(parseMemberStatusFilter("all"), null);
  assert.equal(parseMemberStatusFilter(undefined), null);
});

test("membership length labels", async () => {
  const { lengthLabel, MEMBERSHIP_LENGTHS } = await import("@/lib/fee-memory");
  assert.equal(lengthLabel(1), "1 month");
  assert.equal(lengthLabel(3), "3 months");
  assert.equal(lengthLabel(12), "1 year");
  assert.equal(lengthLabel(24), "2 years");
  assert.deepEqual(MEMBERSHIP_LENGTHS.map((l) => l.months), [1, 3, 6, 12]);
});
