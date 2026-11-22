import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  firstAllowedPath,
  hasPermission,
  normalizePermissions,
  permissionsForPath,
} from "@/lib/staff-permissions";
import { recordedByLabel } from "@/lib/recorded-by";

test("owners have every permission, staff only what they were given", () => {
  const owner = { role: "GYM_OWNER" };
  const staff = { role: "STAFF", staff_permissions: ["members.view", "members.create"] };

  assert.equal(hasPermission(owner, "members.delete"), true);
  assert.equal(hasPermission(owner, "dashboard.revenue"), true);

  assert.equal(hasPermission(staff, "members.create"), true);
  assert.equal(hasPermission(staff, "members.delete"), false);
  assert.equal(hasPermission(staff, "dashboard.revenue"), false);
});

test("admins, members and signed-out users get no gym permissions", () => {
  assert.equal(hasPermission({ role: "SUPER_ADMIN" }, "members.view"), false);
  assert.equal(hasPermission({ role: "MEMBER", staff_permissions: ["members.view"] }, "members.view"), false);
  assert.equal(hasPermission(null, "members.view"), false);
  assert.equal(hasPermission({ role: "STAFF" }, "members.view"), false);
});

test("normalizePermissions drops unknown keys and adds the page's view", () => {
  const result = normalizePermissions(["members.delete", "billing.manage", 42, "members.delete"]);
  assert.deepEqual(result, ["members.view", "members.delete"]);
});

test("normalizePermissions rejects non-arrays", () => {
  assert.deepEqual(normalizePermissions("members.view"), []);
  assert.deepEqual(normalizePermissions(undefined), []);
});

test("default staff permissions are all real keys and include no money or delete rights", () => {
  for (const key of DEFAULT_STAFF_PERMISSIONS) assert.ok(ALL_PERMISSIONS.includes(key), key);
  assert.deepEqual(normalizePermissions(DEFAULT_STAFF_PERMISSIONS), DEFAULT_STAFF_PERMISSIONS);
  for (const key of ["dashboard.revenue", "expenses.cashbook", "members.delete", "membersubscriptions.delete"]) {
    assert.equal(DEFAULT_STAFF_PERMISSIONS.includes(key), false, key);
  }
});

test("page routes need the page's view permission", () => {
  assert.deepEqual(permissionsForPath("/members"), ["members.view"]);
  assert.deepEqual(permissionsForPath("/dashboard"), ["dashboard.view"]);
  assert.deepEqual(permissionsForPath("/expenses"), ["expenses.view"]);
});

test("manage pages need the permission for the action", () => {
  assert.deepEqual(permissionsForPath("/members/manage", "create"), ["members.create"]);
  assert.deepEqual(permissionsForPath("/members/manage", "edit"), ["members.edit"]);
  assert.deepEqual(permissionsForPath("/equipment/manage", "view"), ["equipment.view"]);
  assert.deepEqual(permissionsForPath("/todos/manage"), ["todos.create", "todos.edit"]);
  assert.deepEqual(permissionsForPath("/members/import"), ["members.import"]);
  assert.deepEqual(permissionsForPath("/payments/manage", "create"), ["payments.record"]);
});

test("a similar prefix is not the same page", () => {
  // "/membersubscriptions" must not be treated as part of "/members".
  assert.deepEqual(permissionsForPath("/membersubscriptions"), ["membersubscriptions.view"]);
});

test("routes outside the catalogue aren't staff-controllable", () => {
  assert.equal(permissionsForPath("/profile"), null);
  assert.equal(permissionsForPath("/staff"), null);
});

test("firstAllowedPath picks the first page staff can open", () => {
  assert.equal(firstAllowedPath(["dashboard.view", "members.view"]), "/dashboard");
  assert.equal(firstAllowedPath(["members.view"]), "/members");
  assert.equal(firstAllowedPath([]), "/profile");
  assert.equal(firstAllowedPath(undefined), "/profile");
});

test("recordedByLabel names the person and their role", () => {
  assert.equal(recordedByLabel({ first_name: "Ali", last_name: "Khan", role: "STAFF" }), "Ali Khan (staff)");
  assert.equal(recordedByLabel({ first_name: "Sara", last_name: null, role: "GYM_OWNER" }), "Sara (owner)");
  assert.equal(recordedByLabel({ first_name: null, last_name: null, role: "STAFF" }), "Staff");
  assert.equal(recordedByLabel(null), "-");
});
