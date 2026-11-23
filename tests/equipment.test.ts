import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultEquipmentType,
  equipmentCategoryLabel,
  equipmentConditionLabel,
  maintenanceState,
  maintenanceText,
} from "@/lib/equipment";

const now = new Date(2026, 10, 23, 15, 0);
const day = (d: number) => new Date(2026, 10, d, 9, 0);

test("maintenance: overdue, due this week, later, or nothing to say", () => {
  assert.deepEqual(maintenanceState(day(20), "ACTIVE", now), { kind: "overdue", days: 3 });
  assert.deepEqual(maintenanceState(day(23), "ACTIVE", now), { kind: "soon", days: 0 });
  assert.deepEqual(maintenanceState(day(30), "ACTIVE", now), { kind: "soon", days: 7 });
  assert.deepEqual(maintenanceState(new Date(2026, 11, 1), "ACTIVE", now), { kind: "later", days: 8 });
  assert.deepEqual(maintenanceState(null, "ACTIVE", now), { kind: "none" });
  // Retired equipment needs no maintenance.
  assert.deepEqual(maintenanceState(day(20), "RETIRED", now), { kind: "none" });
});

test("maintenance text", () => {
  assert.equal(maintenanceText({ kind: "overdue", days: 1 }), "Overdue by 1 day");
  assert.equal(maintenanceText({ kind: "overdue", days: 3 }), "Overdue by 3 days");
  assert.equal(maintenanceText({ kind: "soon", days: 0 }), "Due today");
  assert.equal(maintenanceText({ kind: "soon", days: 2 }), "Due in 2 days");
  assert.equal(maintenanceText({ kind: "later", days: 20 }), null);
  assert.equal(maintenanceText({ kind: "none" }), null);
});

test("type: kept when given, else the category's name", () => {
  assert.equal(defaultEquipmentType("Treadmill", "CARDIO"), "Treadmill");
  assert.equal(defaultEquipmentType("  ", "CARDIO"), "Cardio");
  assert.equal(defaultEquipmentType(undefined, "FREE_WEIGHTS"), "Free weights");
  assert.equal(defaultEquipmentType(undefined, undefined), "Other");
});

test("labels in plain words", () => {
  assert.equal(equipmentCategoryLabel("STRENGTH"), "Strength machines");
  assert.equal(equipmentConditionLabel("NEEDS_MAINTENANCE"), "Needs repair");
  assert.equal(equipmentConditionLabel(null), null);
});
