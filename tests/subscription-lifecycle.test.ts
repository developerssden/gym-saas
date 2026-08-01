import assert from "node:assert/strict";
import test from "node:test";
import {
  notificationLifecycleReset,
  startsNewSubscriptionLifecycle,
} from "@/lib/subscription-lifecycle";

const currentEndDate = new Date("2026-07-18T00:00:00.000Z");

test("advancing an end date starts a fresh notification lifecycle", () => {
  const nextEndDate = new Date("2026-08-18T00:00:00.000Z");

  assert.equal(
    startsNewSubscriptionLifecycle(currentEndDate, nextEndDate),
    true
  );
  assert.deepEqual(notificationLifecycleReset(currentEndDate, nextEndDate), {
    first_reminder_sent: false,
    second_reminder_sent: false,
    notification_sent: false,
  });
});

test("unchanged or shortened lifecycles do not reset delivery history", () => {
  assert.deepEqual(
    notificationLifecycleReset(currentEndDate, currentEndDate),
    {}
  );
  assert.deepEqual(
    notificationLifecycleReset(
      currentEndDate,
      new Date("2026-07-17T00:00:00.000Z")
    ),
    {}
  );
});

test("invalid dates do not trigger a reset", () => {
  assert.equal(
    startsNewSubscriptionLifecycle(currentEndDate, new Date("invalid")),
    false
  );
});
