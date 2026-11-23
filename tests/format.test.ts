import assert from "node:assert/strict";
import test from "node:test";
import {
  billingModelLabel,
  codeLabel,
  equipmentStatusLabel,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatShortDate,
  paymentMethodLabel,
  roleLabel,
  subscriptionTypeLabel,
} from "@/lib/format";

// Local-time constructors so the tests don't depend on the machine's timezone.
const nov22 = new Date(2026, 10, 22, 15, 5);

test("formatDate uses d MMM yyyy", () => {
  assert.equal(formatDate(nov22), "22 Nov 2026");
  assert.equal(formatDate(new Date(2026, 0, 3)), "3 Jan 2026");
  assert.equal(formatDate(nov22.toISOString()), "22 Nov 2026");
  assert.equal(formatDate(nov22.getTime()), "22 Nov 2026");
});

test("formatDate falls back for missing or invalid dates", () => {
  for (const v of [null, undefined, "", "not a date"]) assert.equal(formatDate(v), "—");
  assert.equal(formatDate(null, "Never"), "Never");
});

test("formatDateTime adds a 12-hour time", () => {
  assert.equal(formatDateTime(nov22), "22 Nov 2026, 3:05 pm");
  assert.equal(formatDateTime(new Date(2026, 10, 22, 0, 30)), "22 Nov 2026, 12:30 am");
  assert.equal(formatDateTime(undefined), "—");
});

test("formatShortDate drops the year", () => {
  assert.equal(formatShortDate(nov22), "22 Nov");
});

test("formatDateRange keeps one year when both dates share it", () => {
  assert.equal(formatDateRange(new Date(2026, 10, 1), new Date(2026, 10, 30)), "1 Nov – 30 Nov 2026");
  assert.equal(formatDateRange(new Date(2026, 11, 15), new Date(2027, 0, 14)), "15 Dec 2026 – 14 Jan 2027");
  assert.equal(formatDateRange(null, new Date(2026, 10, 30)), "30 Nov 2026");
  assert.equal(formatDateRange(null, null), "—");
});

test("enum labels are plain words", () => {
  assert.equal(billingModelLabel("MONTHLY"), "Monthly");
  assert.equal(billingModelLabel("YEARLY"), "Yearly");
  assert.equal(paymentMethodLabel("CASH"), "Cash");
  assert.equal(paymentMethodLabel("BANK_TRANSFER"), "Bank transfer");
  assert.equal(subscriptionTypeLabel("MEMBER"), "Member fee");
  assert.equal(subscriptionTypeLabel("OWNER"), "Gym plan");
  assert.equal(roleLabel("GYM_OWNER"), "Owner");
  assert.equal(roleLabel("STAFF"), "Staff");
  assert.equal(equipmentStatusLabel("IN_REPAIR"), "In repair");
});

test("unknown or missing codes stay readable", () => {
  assert.equal(paymentMethodLabel("EASY_PAISA"), "Easy paisa");
  assert.equal(codeLabel("ONBOARDED"), "Onboarded");
  assert.equal(billingModelLabel(null), "—");
  assert.equal(codeLabel(undefined, ""), "");
});
