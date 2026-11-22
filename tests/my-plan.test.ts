import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanUsage, planFeatures, planStatus, usageState } from "@/lib/my-plan";

const now = new Date("2026-11-22T12:00:00Z");

test("plan status: none, active, ending soon, expired", () => {
  assert.deepEqual(planStatus(null, now), { kind: "none" });
  const active = planStatus({ end_date: "2026-12-22T12:00:00Z", is_active: true, is_expired: false }, now);
  assert.equal(active.kind, "active");
  assert.equal(active.kind === "active" && active.daysLeft, 30);
  const soon = planStatus({ end_date: "2026-11-25T12:00:00Z", is_active: true, is_expired: false }, now);
  assert.equal(soon.kind === "expiring" && soon.daysLeft, 3);
  // Flagged expired, switched off, or past its end date all count as expired.
  for (const sub of [
    { end_date: "2026-12-22T12:00:00Z", is_active: true, is_expired: true },
    { end_date: "2026-12-22T12:00:00Z", is_active: false, is_expired: false },
    { end_date: "2026-11-01T12:00:00Z", is_active: true, is_expired: false },
  ]) {
    assert.equal(planStatus(sub, now).kind, "expired");
  }
});

test("usage state: a 0 limit means not included, not full", () => {
  assert.equal(usageState(0, 0), "notIncluded");
  assert.equal(usageState(1, 3), "ok");
  assert.equal(usageState(2, 3), "near");
  assert.equal(usageState(3, 3), "full");
  assert.equal(usageState(85, 100), "ok");
  assert.equal(usageState(90, 100), "near");
});

test("members and equipment are per branch; the rest are account-wide", () => {
  const limits = { max_gyms: 1, max_locations: 2, max_members: 100, max_equipment: 50, max_staff: 0 };
  const usage = buildPlanUsage(limits, { gyms: 1, locations: 2, staff: 0 }, [
    { name: "DHA", members: 100, equipment: 10 },
    { name: "Gulberg", members: 20, equipment: 0 },
  ]);
  const by = Object.fromEntries(usage.map(u => [u.key, u]));
  assert.deepEqual(by.gyms.rows.map(r => [r.used, r.max, r.state]), [[1, 1, "full"]]);
  assert.deepEqual(by.staff.rows.map(r => r.state), ["notIncluded"]);
  assert.deepEqual(by.members.rows.map(r => [r.label, r.used, r.state]), [["DHA", 100, "full"], ["Gulberg", 20, "ok"]]);
  assert.equal(by.equipment.rows.length, 2);
});

test("features describe the plan's limits in words", () => {
  const features = planFeatures({ max_gyms: 1, max_locations: 3, max_members: 200, max_equipment: 1, max_staff: 2 });
  assert.equal(features[0], "Up to 1 gym and 3 branches");
  assert.equal(features[2], "1 equipment item per branch");
  assert.equal(features[3], "2 staff logins with their own permissions");
  assert.equal(planFeatures({ max_gyms: 1, max_locations: 1, max_members: 1, max_equipment: 1, max_staff: 0 })[3], "No staff logins");
});
