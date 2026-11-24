import assert from "node:assert/strict";
import test from "node:test";
import { dayLabel, groupByDay } from "@/lib/notifications/group-by-day";

const now = new Date(2026, 10, 24, 15, 0);

test("days are labelled Today, Yesterday, then the date", () => {
  assert.equal(dayLabel(new Date(2026, 10, 24, 8, 0), now), "Today");
  assert.equal(dayLabel(new Date(2026, 10, 23, 23, 59), now), "Yesterday");
  assert.equal(dayLabel(new Date(2026, 10, 20, 9, 0), now), "20 Nov 2026");
});

test("notifications are grouped per day, newest first, keeping their order", () => {
  const items = [
    { id: "a", createdAt: new Date(2026, 10, 24, 14, 0).toISOString() },
    { id: "b", createdAt: new Date(2026, 10, 24, 9, 0).toISOString() },
    { id: "c", createdAt: new Date(2026, 10, 23, 18, 0).toISOString() },
    { id: "d", createdAt: new Date(2026, 10, 20, 9, 0).toISOString() },
  ];
  const groups = groupByDay(items, now);
  assert.deepEqual(
    groups.map(g => [g.label, g.items.map(i => i.id)]),
    [
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      ["20 Nov 2026", ["d"]],
    ]
  );
});

test("no notifications, no groups", () => {
  assert.deepEqual(groupByDay([], now), []);
});
