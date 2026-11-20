import assert from "node:assert/strict";
import test from "node:test";
import {
  computeUnfreeze,
  parseCalendarDay,
  validateFreezeStart,
} from "@/lib/subscription-freeze";

const TZ = "Asia/Karachi";
// 20 Nov 2026, 10:00 in Karachi
const now = new Date("2026-11-20T05:00:00.000Z");

const active = {
  start_date: new Date("2026-11-01T07:00:00.000Z"),
  end_date: new Date("2026-12-01T07:00:00.000Z"),
  is_active: true,
  is_expired: false,
  frozen_since: null as Date | null,
};

test("parseCalendarDay accepts YYYY-MM-DD and rejects anything else", () => {
  assert.equal(parseCalendarDay("2026-11-16")?.toISOString(), "2026-11-16T12:00:00.000Z");
  for (const bad of ["", "16/11/2026", "2026-02-30", "2026-13-01", undefined, 20261116]) {
    assert.equal(parseCalendarDay(bad), null, String(bad));
  }
});

test("an active subscription can be frozen from today or a past day in its term", () => {
  assert.equal(validateFreezeStart(active, parseCalendarDay("2026-11-20")!, now, TZ), null);
  assert.equal(validateFreezeStart(active, parseCalendarDay("2026-11-01")!, now, TZ), null);
});

test("freeze start is rejected when it makes no sense", () => {
  assert.match(validateFreezeStart(active, parseCalendarDay("2026-11-21")!, now, TZ)!, /future/);
  assert.match(validateFreezeStart(active, parseCalendarDay("2026-10-31")!, now, TZ)!, /before the subscription started/);

  const endsToday = { ...active, start_date: new Date("2026-10-01T07:00:00.000Z"), end_date: new Date("2026-11-20T07:00:00.000Z") };
  assert.match(validateFreezeStart(endsToday, parseCalendarDay("2026-11-20")!, now, TZ)!, /before the subscription ends/);
});

test("only active, unfrozen, non-expired subscriptions can be frozen", () => {
  const day = parseCalendarDay("2026-11-20")!;
  assert.match(validateFreezeStart({ ...active, frozen_since: day }, day, now, TZ)!, /already frozen/);
  assert.match(validateFreezeStart({ ...active, is_expired: true }, day, now, TZ)!, /Only active/);
  assert.match(validateFreezeStart({ ...active, is_active: false }, day, now, TZ)!, /Only active/);
});

test("unfreezing adds the frozen days to the end date (frozen Mon, back Thu = 3 days)", () => {
  const frozen = { end_date: active.end_date, frozen_since: parseCalendarDay("2026-11-16")! }; // Monday
  const result = computeUnfreeze(frozen, parseCalendarDay("2026-11-19")!, now, TZ); // Thursday
  assert.ok(result.ok);
  assert.equal(result.days, 3);
  assert.equal(result.newEndDate.toISOString(), "2026-12-04T07:00:00.000Z");
});

test("freezing for 10 days and then unfreezing pushes the end date out by 10 days", () => {
  const frozen = { end_date: active.end_date, frozen_since: parseCalendarDay("2026-11-10")! };
  const result = computeUnfreeze(frozen, parseCalendarDay("2026-11-20")!, now, TZ);
  assert.ok(result.ok);
  assert.equal(result.days, 10);
  assert.equal(result.newEndDate.toISOString(), "2026-12-11T07:00:00.000Z");
});

test("a subscription whose end date passed while frozen is extended past it", () => {
  // Ended 18 Nov while frozen since 1 Nov; back 20 Nov → +19 days → 7 Dec.
  const frozen = { end_date: new Date("2026-11-18T07:00:00.000Z"), frozen_since: parseCalendarDay("2026-11-01")! };
  const result = computeUnfreeze(frozen, parseCalendarDay("2026-11-20")!, now, TZ);
  assert.ok(result.ok);
  assert.equal(result.days, 19);
  assert.equal(result.newEndDate.toISOString(), "2026-12-07T07:00:00.000Z");
});

test("unfreezing the same day adds nothing; bad return dates are rejected", () => {
  const frozen = { end_date: active.end_date, frozen_since: parseCalendarDay("2026-11-20")! };
  const same = computeUnfreeze(frozen, parseCalendarDay("2026-11-20")!, now, TZ);
  assert.ok(same.ok && same.days === 0);

  const before = computeUnfreeze(frozen, parseCalendarDay("2026-11-19")!, now, TZ);
  assert.ok(!before.ok && /before the freeze started/.test(before.error));

  const future = computeUnfreeze(frozen, parseCalendarDay("2026-11-21")!, now, TZ);
  assert.ok(!future.ok && /future/.test(future.error));

  const notFrozen = computeUnfreeze({ ...frozen, frozen_since: null }, now, now, TZ);
  assert.ok(!notFrozen.ok && /isn't frozen/.test(notFrozen.error));
});
