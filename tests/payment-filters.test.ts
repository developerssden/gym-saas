import { test } from "node:test";
import assert from "node:assert/strict";
import { periodRange } from "@/lib/payments/period";
import { paymentFilterWhere } from "@/lib/payments/payment-search";
import { paymentIdFrom } from "@/lib/offline/submit";

// Wednesday 18 Nov 2026, mid-afternoon (device time).
const now = new Date(2026, 10, 18, 15, 30);
const day = (d: number, m = 10) => new Date(2026, m, d);

test("today runs from midnight to the next midnight", () => {
  assert.deepEqual(periodRange("today", now), { from: day(18), to: day(19) });
});

test("this week starts on Monday and includes today", () => {
  assert.deepEqual(periodRange("week", now), { from: day(16), to: day(19) });
});

test("this month starts on the 1st and includes today", () => {
  assert.deepEqual(periodRange("month", now), { from: day(1), to: day(19) });
});

test("all has no dates", () => {
  assert.deepEqual(periodRange("all", now), {});
});

test("custom dates include both whole days, and swapped dates are put in order", () => {
  assert.deepEqual(periodRange("custom", now, { from: "2026-11-01", to: "2026-11-10" }), { from: day(1), to: day(11) });
  assert.deepEqual(periodRange("custom", now, { from: "2026-11-10", to: "2026-11-01" }), { from: day(1), to: day(11) });
});

test("custom with one or no valid date filters only that side", () => {
  assert.deepEqual(periodRange("custom", now, { from: "2026-11-05" }), { from: day(5), to: undefined });
  assert.deepEqual(periodRange("custom", now, { from: "nonsense" }), { from: undefined, to: undefined });
});

test("filters: dates and method become a where fragment", () => {
  assert.deepEqual(
    paymentFilterWhere({
      date_from: "2026-11-18T00:00:00.000Z",
      date_to: "2026-11-19T00:00:00.000Z",
      payment_method: "CASH",
    }),
    {
      payment_date: { gte: new Date("2026-11-18T00:00:00.000Z"), lt: new Date("2026-11-19T00:00:00.000Z") },
      payment_method: "CASH",
    }
  );
  assert.deepEqual(paymentFilterWhere({ date_from: "2026-11-18T00:00:00.000Z" }), {
    payment_date: { gte: new Date("2026-11-18T00:00:00.000Z") },
  });
});

test("filters: missing or invalid values are ignored", () => {
  assert.equal(paymentFilterWhere({}), null);
  assert.equal(paymentFilterWhere({ date_from: "nope", date_to: 42, payment_method: "CHEQUE" }), null);
});

test("payment id comes from a new payment, a renewal or a replay", () => {
  assert.equal(paymentIdFrom({ data: { id: "p1" } }), "p1");
  // Renewal: data is the subscription, the payment id is separate (null when nothing was paid).
  assert.equal(paymentIdFrom({ data: { id: "sub1" }, payment_id: "p2" }), "p2");
  assert.equal(paymentIdFrom({ data: { id: "sub1" }, payment_id: null }), null);
  assert.equal(paymentIdFrom({ data: { id: "p3" }, duplicate: true }), "p3");
  assert.equal(paymentIdFrom(undefined), null);
});
