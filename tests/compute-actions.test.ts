import assert from "node:assert/strict";
import test from "node:test";
import {
  computeMemberActions,
  computeOwnerActions,
} from "@/lib/cron/computeActions";
import {
  executeExpirationDelivery,
  executeReminderDelivery,
} from "@/lib/cron/delivery";

const referenceDate = new Date("2026-07-18T00:00:00.000Z");

function ownerSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "owner-sub",
    end_date: new Date("2026-07-20T00:00:00.000Z"),
    notification_sent: false,
    first_reminder_sent: false,
    second_reminder_sent: false,
    owner: {
      email: "owner@example.com",
      first_name: "Gym",
      last_name: "Owner",
    },
    plan: { name: "Pro" },
    ...overrides,
  };
}

function memberSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "member-sub",
    end_date: new Date("2026-07-20T00:00:00.000Z"),
    notification_sent: false,
    first_reminder_sent: false,
    second_reminder_sent: false,
    member: {
      user: {
        email: "member@example.com",
        first_name: "Gym",
        last_name: "Member",
      },
    },
    ...overrides,
  };
}

test("owner and member actions use the same two-day reminder policy", () => {
  assert.equal(
    computeOwnerActions(
      [ownerSubscription()],
      referenceDate,
      "Asia/Karachi"
    )[0].type,
    "FIRST_REMINDER"
  );
  assert.equal(
    computeMemberActions(
      [memberSubscription()],
      referenceDate,
      "Asia/Karachi"
    )[0].type,
    "FIRST_REMINDER"
  );
});

test("the most urgent applicable unsent reminder wins after a missed run", () => {
  const oneDayEnd = new Date("2026-07-19T00:00:00.000Z");
  const action = computeOwnerActions(
    [ownerSubscription({ end_date: oneDayEnd })],
    referenceDate,
    "Asia/Karachi"
  )[0];

  assert.equal(action.type, "SECOND_REMINDER");
});

test("reminder flags remain independent", () => {
  const oneDayEnd = new Date("2026-07-19T00:00:00.000Z");

  assert.equal(
    computeOwnerActions(
      [
        ownerSubscription({
          end_date: oneDayEnd,
          first_reminder_sent: true,
        }),
      ],
      referenceDate,
      "Asia/Karachi"
    )[0].type,
    "SECOND_REMINDER"
  );

  assert.equal(
    computeOwnerActions(
      [
        ownerSubscription({
          end_date: oneDayEnd,
          second_reminder_sent: true,
        }),
      ],
      referenceDate,
      "Asia/Karachi"
    )[0].type,
    "NONE"
  );
});

test("expiration remains retryable until notification delivery is recorded", () => {
  const expired = new Date("2026-07-18T00:00:00.000Z");

  assert.equal(
    computeOwnerActions(
      [ownerSubscription({ end_date: expired })],
      referenceDate,
      "Asia/Karachi"
    )[0].type,
    "EXPIRE"
  );
  assert.equal(
    computeOwnerActions(
      [
        ownerSubscription({
          end_date: expired,
          notification_sent: true,
        }),
      ],
      referenceDate,
      "Asia/Karachi"
    )[0].type,
    "NONE"
  );
});

test("expiration state is committed before delivery and failed delivery is not recorded", async () => {
  const calls: string[] = [];
  const result = await executeExpirationDelivery({
    alreadyExpired: false,
    hasRecipient: true,
    markExpired: async () => {
      calls.push("expired");
    },
    send: async () => {
      calls.push("send");
      throw new Error("smtp unavailable");
    },
    markDelivered: async () => {
      calls.push("delivered");
    },
  });

  assert.deepEqual(calls, ["expired", "send"]);
  assert.equal(result.stateChanged, true);
  assert.equal(result.failed, true);
  assert.equal(result.sent, false);
});

test("delivery flags are written only after a successful send", async () => {
  const calls: string[] = [];
  const result = await executeReminderDelivery({
    hasRecipient: true,
    send: async () => {
      calls.push("send");
    },
    markDelivered: async () => {
      calls.push("delivered");
    },
  });

  assert.deepEqual(calls, ["send", "delivered"]);
  assert.equal(result.sent, true);
});

test("missing recipients are skipped without marking delivery", async () => {
  let called = false;
  const result = await executeExpirationDelivery({
    alreadyExpired: true,
    hasRecipient: false,
    markExpired: async () => {
      called = true;
    },
    send: async () => {
      called = true;
    },
    markDelivered: async () => {
      called = true;
    },
  });

  assert.equal(called, false);
  assert.equal(result.skipped, true);
});
