import assert from "node:assert/strict";
import test from "node:test";
import {
  getCalendarDayOrdinal,
  getDaysUntilExpiration,
  isExpiredOrToday,
} from "@/lib/date-utils";

test("calculates days using the configured business calendar", () => {
  const reference = new Date("2026-07-17T19:30:00.000Z");
  const endDate = new Date("2026-07-19T00:00:00.000Z");

  assert.equal(
    getDaysUntilExpiration(endDate, reference, "Asia/Karachi"),
    1
  );
  assert.equal(isExpiredOrToday(reference, reference, "Asia/Karachi"), true);
});

test("calendar ordinals remain one day apart across DST changes", () => {
  const beforeSpringForward = new Date("2026-03-08T05:00:00.000Z");
  const afterSpringForward = new Date("2026-03-09T04:00:00.000Z");

  assert.equal(
    getCalendarDayOrdinal(afterSpringForward, "America/New_York") -
      getCalendarDayOrdinal(beforeSpringForward, "America/New_York"),
    1
  );
});

test("rejects invalid dates instead of silently returning no action", () => {
  assert.throws(
    () =>
      getDaysUntilExpiration(
        new Date("invalid"),
        new Date("2026-07-18T00:00:00.000Z")
      ),
    /Invalid date/
  );
});
