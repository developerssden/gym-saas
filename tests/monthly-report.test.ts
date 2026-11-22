import assert from "node:assert/strict";
import test from "node:test";
import { calendarMonthRange, formatCalendarMonth, previousCalendarMonth } from "@/lib/date-utils";
import { buildMonthlyReport, monthLabel, type ReportSubscriptionRow } from "@/lib/monthly-report";

const TZ = "Asia/Karachi"; // UTC+5, no daylight saving

test("calendar month range starts and ends at local midnight", () => {
  const r = calendarMonthRange("2026-03", TZ)!;
  assert.equal(r.start.toISOString(), "2026-02-28T19:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-03-31T19:00:00.000Z");
  const dec = calendarMonthRange("2026-12", TZ)!;
  assert.equal(dec.end.toISOString(), "2026-12-31T19:00:00.000Z");
});

test("invalid months are rejected", () => {
  for (const bad of ["2026-13", "2026-00", "2026-1", "March", ""]) {
    assert.equal(calendarMonthRange(bad, TZ), null, bad);
  }
});

test("month helpers", () => {
  // 20:00 UTC on 31 Jan is already 1 Feb in Karachi.
  assert.equal(formatCalendarMonth(new Date("2026-01-31T20:00:00Z"), TZ), "2026-02");
  assert.equal(previousCalendarMonth("2026-01"), "2025-12");
  assert.equal(previousCalendarMonth("2026-07"), "2026-06");
  assert.equal(monthLabel("2026-11"), "November 2026");
});

const range = calendarMonthRange("2026-03", TZ)!;
const d = (iso: string) => new Date(iso);

function sub(overrides: Partial<ReportSubscriptionRow>): ReportSubscriptionRow {
  return {
    id: "s",
    member_id: "m",
    member_name: "Member",
    member_phone: null,
    price: 3000,
    discount: 0,
    admission_fee: 0,
    billing_model: "MONTHLY",
    start_date: d("2026-02-01T12:00:00Z"),
    end_date: d("2026-03-01T12:00:00Z"),
    createdAt: d("2026-02-01T12:00:00Z"),
    churn_reason: null,
    churn_note: null,
    payments: [],
    ...overrides,
  };
}

test("money: collected, by method, expenses by category, profit", () => {
  const report = buildMonthlyReport({
    month: "2026-03",
    range,
    now: d("2026-04-10T00:00:00Z"),
    payments: [
      { amount: 3000, payment_method: "CASH", payment_date: d("2026-03-02T10:00:00Z") },
      { amount: 2000, payment_method: "CASH", payment_date: d("2026-03-05T10:00:00Z") },
      { amount: 5000, payment_method: "BANK_TRANSFER", payment_date: d("2026-03-06T10:00:00Z") },
    ],
    expenses: [
      { amount: 4000, category: "RENT" },
      { amount: 1500, category: "UTILITIES" },
      { amount: 500, category: "UTILITIES" },
    ],
    newMembers: 2,
    subscriptions: [],
  });
  assert.equal(report.isCurrentMonth, false);
  assert.equal(report.money.collected, 10000);
  assert.equal(report.money.paymentsCount, 3);
  assert.deepEqual(
    report.money.collectedByMethod.map(r => [r.label, r.amount, r.count]),
    [["Cash", 5000, 2], ["Bank transfer", 5000, 1]]
  );
  assert.deepEqual(report.money.expensesByCategory.map(r => [r.label, r.amount]), [["Rent", 4000], ["Utilities", 2000]]);
  assert.equal(report.money.expenses, 6000);
  assert.equal(report.money.profit, 4000);
  assert.equal(report.members.newMembers, 2);
});

test("outstanding is measured at month end", () => {
  const report = buildMonthlyReport({
    month: "2026-03",
    range,
    now: d("2026-04-10T00:00:00Z"),
    payments: [],
    expenses: [],
    newMembers: 0,
    subscriptions: [
      // Paid 1000 of 3000 in March, rest paid in April: owed 2000 at March end.
      sub({
        id: "a",
        member_id: "m1",
        createdAt: d("2026-03-03T10:00:00Z"),
        payments: [
          { amount: 1000, payment_date: d("2026-03-03T10:00:00Z") },
          { amount: 2000, payment_date: d("2026-04-02T10:00:00Z") },
        ],
      }),
      // Recorded in April: not part of March.
      sub({ id: "b", member_id: "m2", createdAt: d("2026-04-02T10:00:00Z") }),
      // Fully paid.
      sub({
        id: "c",
        member_id: "m3",
        discount: 500,
        admission_fee: 1000,
        payments: [{ amount: 3500, payment_date: d("2026-02-01T12:00:00Z") }],
      }),
    ],
  });
  assert.equal(report.money.outstanding, 2000);
  assert.equal(report.money.outstandingMembers, 1);
});

test("new subscriptions, renewals, top plans, expiries and members lost", () => {
  const report = buildMonthlyReport({
    month: "2026-03",
    range,
    now: d("2026-03-20T00:00:00Z"),
    payments: [],
    expenses: [],
    newMembers: 0,
    subscriptions: [
      // m1: February sub ends 10 March, renewed on 9 March.
      sub({ id: "m1-feb", member_id: "m1", member_name: "Ali", end_date: d("2026-03-10T12:00:00Z") }),
      sub({ id: "m1-mar", member_id: "m1", createdAt: d("2026-03-09T10:00:00Z"), end_date: d("2026-04-10T12:00:00Z") }),
      // m2: ends 12 March, not renewed, reason recorded.
      sub({ id: "m2", member_id: "m2", member_name: "Sara", end_date: d("2026-03-12T12:00:00Z"), churn_reason: "TOO_EXPENSIVE" }),
      // m3: ends 15 March, not renewed, no reason.
      sub({ id: "m3", member_id: "m3", member_name: "Omar", end_date: d("2026-03-15T12:00:00Z") }),
      // m4: ends 28 March, after "now", so not lost yet.
      sub({ id: "m4", member_id: "m4", member_name: "Hina", end_date: d("2026-03-28T12:00:00Z") }),
      // m5: brand new yearly member in March.
      sub({ id: "m5", member_id: "m5", billing_model: "YEARLY", price: 30000, createdAt: d("2026-03-04T10:00:00Z"), end_date: d("2027-03-04T12:00:00Z") }),
      // m6: new monthly member in March.
      sub({ id: "m6", member_id: "m6", createdAt: d("2026-03-06T10:00:00Z"), end_date: d("2026-04-06T12:00:00Z") }),
    ],
  });
  assert.equal(report.isCurrentMonth, true);
  assert.equal(report.members.newSubscriptions, 3);
  assert.equal(report.members.renewals, 1);
  assert.deepEqual(
    report.topPlans.map(p => [p.label, p.price, p.count]),
    [["Monthly", 3000, 2], ["Yearly", 30000, 1]]
  );
  assert.deepEqual(
    report.expiryList.map(e => [e.member_name, e.renewed, e.lost]),
    [["Ali", true, false], ["Sara", false, true], ["Omar", false, true], ["Hina", false, false]]
  );
  assert.equal(report.members.expiries, 4);
  assert.equal(report.members.lost, 2);
  assert.deepEqual(
    report.members.lostByReason.map(r => [r.label, r.count]).sort(),
    [["Not recorded", 1], ["Too expensive", 1]]
  );
});
