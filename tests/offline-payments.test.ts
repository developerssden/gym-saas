import assert from "node:assert/strict";
import test from "node:test";
import { parseClientId, parseRecordedAt } from "@/lib/offline/request-fields";
import {
  applyPendingPayments,
  classifySyncResponse,
  MAX_SERVER_ERROR_ATTEMPTS,
  searchDirectory,
  type DirectoryMember,
} from "@/lib/offline/outbox-types";
import type { FeeAction } from "@/lib/quick-payment";

test("client_id: optional, must look like an id", () => {
  assert.deepEqual(parseClientId(undefined), { ok: true, value: null });
  assert.deepEqual(parseClientId(""), { ok: true, value: null });
  const id = "3b241101-e2bb-4255-8caf-4136c566a962";
  assert.deepEqual(parseClientId(id), { ok: true, value: id });
  for (const bad of ["short", "has spaces in it!", 42, "x".repeat(65), "drop table;--"]) {
    assert.equal(parseClientId(bad).ok, false, String(bad));
  }
});

test("recorded_at: a real past time within 30 days", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  assert.deepEqual(parseRecordedAt(undefined, now), { ok: true, value: null });
  const twoHoursAgo = parseRecordedAt("2026-11-22T10:00:00Z", now);
  assert.equal(twoHoursAgo.ok && twoHoursAgo.value?.toISOString(), "2026-11-22T10:00:00.000Z");
  // A phone clock a few minutes fast is fine; tomorrow is not.
  assert.equal(parseRecordedAt("2026-11-22T12:05:00Z", now).ok, true);
  assert.equal(parseRecordedAt("2026-11-23T12:00:00Z", now).ok, false);
  assert.equal(parseRecordedAt("2026-10-01T12:00:00Z", now).ok, false);
  assert.equal(parseRecordedAt("not a date", now).ok, false);
});

test("sync outcome: saved, retry later, or needs review", () => {
  assert.equal(classifySyncResponse(null, 0), "retry"); // no connection
  assert.equal(classifySyncResponse(201, 0), "done");
  assert.equal(classifySyncResponse(200, 3), "done"); // replay of an already-saved payment
  assert.equal(classifySyncResponse(401, 0), "retry"); // signed out
  assert.equal(classifySyncResponse(400, 0), "failed"); // e.g. already fully paid
  assert.equal(classifySyncResponse(403, 0), "failed");
  assert.equal(classifySyncResponse(500, 0), "retry");
  assert.equal(classifySyncResponse(500, MAX_SERVER_ERROR_ATTEMPTS - 1), "failed");
});

const pay: FeeAction = {
  kind: "pay",
  subscriptionId: "sub-1",
  balance: 3000,
  amountDue: 3000,
  endDate: "2026-12-01T00:00:00.000Z",
  billingModel: "MONTHLY",
};
const renew: FeeAction = {
  kind: "renew",
  price: 3000,
  discount: 0,
  months: 1,
  billingModel: "MONTHLY",
  amountDue: 3000,
  endedOn: "2026-11-01T00:00:00.000Z",
};

test("payments waiting on the device reduce what's owed, so a fee isn't taken twice", () => {
  const partly = applyPendingPayments(pay, [{ kind: "payment", amount: 1000, subscriptionId: "sub-1", status: "pending" }]);
  assert.equal(partly.blockedReason, null);
  assert.equal(partly.action.kind === "pay" && partly.action.balance, 2000);
  assert.equal(partly.pendingAmount, 1000);

  const fully = applyPendingPayments(pay, [{ kind: "payment", amount: 3000, subscriptionId: "sub-1", status: "pending" }]);
  assert.match(fully.blockedReason ?? "", /Already paid/);

  const renewed = applyPendingPayments(renew, [{ kind: "renew", amount: 3000, status: "pending" }]);
  assert.match(renewed.blockedReason ?? "", /Already renewed/);

  // Failed ones weren't recorded, so they don't count.
  const failed = applyPendingPayments(pay, [{ kind: "payment", amount: 3000, subscriptionId: "sub-1", status: "failed" }]);
  assert.equal(failed.blockedReason, null);
  assert.equal(failed.action.kind === "pay" && failed.action.balance, 3000);
});

test("offline member search by name or phone in any format", () => {
  const members: DirectoryMember[] = [
    { id: "1", name: "Ali Khan", phone: "+923011234567", action: pay },
    { id: "2", name: "Sara Ahmed", phone: "03219876543", action: renew },
    { id: "3", name: "Alina", phone: null, action: { kind: "none" } },
  ];
  assert.deepEqual(searchDirectory(members, "ali").map(m => m.id), ["1", "3"]);
  assert.deepEqual(searchDirectory(members, "0301 123").map(m => m.id), ["1"]);
  assert.deepEqual(searchDirectory(members, "+92 321 98").map(m => m.id), ["2"]);
  assert.deepEqual(searchDirectory(members, "a"), []);
});
