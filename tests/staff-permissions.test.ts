import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  firstAllowedPath,
  hasPermission,
  normalizePermissions,
  permissionsForPath,
  PERMISSION_PAGES,
} from "@/lib/staff-permissions";
import { recordedByLabel } from "@/lib/recorded-by";
import { routeItems } from "@/constants/data";
import fs from "node:fs";
import path from "node:path";

// Routes deliberately closed to staff. Adding a page? Either give it a
// PERMISSION_PAGES entry or list it here (see .claude/rules/staff-permissions.md).
const OWNER_ONLY_ROUTES = ["/staff", "/gyms", "/locations", "/subscription"];
const ADMIN_ONLY_ROUTES = ["/clients", "/subscriptions", "/plans", "/registrations", "/announcements"];
const ALL_SIGNED_IN_ROUTES = ["/profile", "/notifications", "/unauthorized"];

/** Top-level routes ("/members") of every page under app/(dashboard), ignoring route groups. */
function dashboardPageRoutes(): string[] {
  const root = path.join(process.cwd(), "app", "(dashboard)");
  const routes = new Set<string>();
  const walk = (dir: string, segments: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
        walk(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]);
      } else if (entry.name === "page.tsx" && segments.length > 0) {
        routes.add(`/${segments[0]}`);
      }
    }
  };
  walk(root, []);
  return [...routes].sort();
}

const permissionRoutes = PERMISSION_PAGES.flatMap(p => p.routes);

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

test("a member's profile page needs members.view", () => {
  assert.deepEqual(permissionsForPath("/members/3f2a9c1e-8b7d-4e6f-9a0b-1c2d3e4f5a6b"), ["members.view"]);
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

test("every dashboard page is in the staff permission catalogue or listed as closed to staff", () => {
  const known = new Set([...permissionRoutes, ...OWNER_ONLY_ROUTES, ...ADMIN_ONLY_ROUTES, ...ALL_SIGNED_IN_ROUTES]);
  const missing = dashboardPageRoutes().filter(r => !known.has(r));
  assert.deepEqual(
    missing,
    [],
    `Add these routes to PERMISSION_PAGES in lib/staff-permissions.ts, or to OWNER_ONLY_ROUTES in this test: ${missing.join(", ")}`
  );
});

test("every permission page route is a real dashboard page", () => {
  const pages = new Set(dashboardPageRoutes());
  assert.deepEqual(permissionRoutes.filter(r => !pages.has(r)), []);
});

test("sidebar items match staff permissions", () => {
  for (const item of routeItems) {
    const forStaff = item.permissions.includes("STAFF");
    if (forStaff) {
      assert.ok(
        permissionsForPath(item.href) || ALL_SIGNED_IN_ROUTES.includes(item.href),
        `${item.href} is shown to staff but has no PERMISSION_PAGES entry`
      );
    } else if (item.permissions.includes("GYM_OWNER")) {
      assert.ok(
        OWNER_ONLY_ROUTES.includes(item.href) || ALL_SIGNED_IN_ROUTES.includes(item.href),
        `${item.href} is an owner page: add STAFF + a PERMISSION_PAGES entry, or list it in OWNER_ONLY_ROUTES`
      );
    }
  }
});
