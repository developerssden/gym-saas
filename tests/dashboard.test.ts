import assert from "node:assert/strict";
import test from "node:test";
import {
  chartMonths,
  compactAmount,
  expiryStatus,
  growthPct,
  initials,
  longMonthName,
  monthLabel,
  owingByMember,
  parseChartRange,
} from "@/lib/dashboard";

test("chart ranges end with the current month", () => {
  assert.deepEqual(chartMonths("6m", "2026-03"), ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
  assert.equal(chartMonths("12m", "2026-11").length, 12);
  assert.equal(chartMonths("12m", "2026-11")[0], "2025-12");
  assert.deepEqual(chartMonths("ytd", "2026-03"), ["2026-01", "2026-02", "2026-03"]);
  assert.deepEqual(chartMonths("ytd", "2026-01"), ["2026-01"]);
});

test("unknown chart ranges fall back to 6 months", () => {
  assert.equal(parseChartRange("12m"), "12m");
  assert.equal(parseChartRange("forever"), "6m");
  assert.equal(parseChartRange(undefined), "6m");
});

test("month labels", () => {
  assert.equal(monthLabel("2026-11"), "Nov");
  assert.equal(monthLabel("2025-12", true), "Dec 25");
  assert.equal(longMonthName("2026-02"), "February");
});

test("growth is null without a previous month to compare", () => {
  assert.equal(growthPct(150, 100), 50);
  assert.equal(growthPct(50, 100), -50);
  assert.equal(growthPct(100, 0), null);
});

test("expiry labels count calendar days in Karachi", () => {
  // 10:00 Karachi on 22 Nov 2026.
  const now = new Date("2026-11-22T05:00:00Z");
  const at = (iso: string) => expiryStatus(new Date(iso), now);
  assert.deepEqual(at("2026-11-22T18:00:00Z"), { days: 0, label: "Expires today", tone: "due" });
  // 23 Nov 03:00 Karachi is "tomorrow" even though it's under 24 hours away.
  assert.equal(at("2026-11-22T22:00:00Z").label, "Expires tomorrow");
  assert.equal(at("2026-11-26T12:00:00Z").label, "Expires in 4 days");
  assert.deepEqual(at("2026-11-21T12:00:00Z"), { days: -1, label: "Expired yesterday", tone: "expired" });
  assert.equal(at("2026-11-17T12:00:00Z").label, "Expired 5 days ago");
});

test("compact amounts use lakh and crore for rupees", () => {
  assert.equal(compactAmount(410000), "4.1L");
  assert.equal(compactAmount(1250000), "13L");
  assert.equal(compactAmount(12000000), "1.2Cr");
  assert.equal(compactAmount(45000), "45K");
  assert.equal(compactAmount(1500), "1.5K");
  assert.equal(compactAmount(900), "900");
  assert.equal(compactAmount(0), "0");
  assert.equal(compactAmount(-45000), "-45K");
  assert.equal(compactAmount(2500000, "USD"), "2.5M");
  assert.equal(compactAmount(410000, "USD"), "410K");
});

test("owing adds up each member's unpaid subscriptions, largest first", () => {
  const subs = [
    { id: "s1", member_id: "ali", price: 5000 }, // paid 2000 → owes 3000
    { id: "s2", member_id: "ali", price: 4000, admission_fee: 1000 }, // unpaid → owes 5000
    { id: "s3", member_id: "sara", price: 6000, discount: 1000 }, // paid 5000 → nothing
    { id: "s4", member_id: "omar", price: 3000 }, // paid 4000 (overpaid) → nothing
    { id: "s5", member_id: "zain", price: 9000 }, // owes 9000
  ];
  const paid = new Map([
    ["s1", 2000],
    ["s3", 5000],
    ["s4", 4000],
  ]);
  assert.deepEqual(owingByMember(subs, paid), [
    { memberId: "zain", balance: 9000, subscriptionId: "s5" },
    { memberId: "ali", balance: 8000, subscriptionId: "s2" },
  ]);
  assert.deepEqual(owingByMember([], new Map()), []);
});

test("initials", () => {
  assert.equal(initials("Ali Khan"), "AK");
  assert.equal(initials("  sara  "), "S");
  assert.equal(initials("Muhammad Abu Bakar"), "MA");
  assert.equal(initials(""), "?");
});
