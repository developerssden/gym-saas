import assert from "node:assert/strict";
import test from "node:test";
import { routeItems } from "@/constants/data";
import { breadcrumbsFor, groupNavItems, navItemForPath, visibleNavItems } from "@/lib/navigation";

const hrefs = (items: { href: string }[]) => items.map(i => i.href);

test("owners see the daily, business and settings sections in order", () => {
  const groups = groupNavItems(visibleNavItems("GYM_OWNER"));
  assert.deepEqual(
    groups.map(g => g.label),
    ["Daily", "Business", "Settings"],
  );
  assert.deepEqual(hrefs(groups[0].items), ["/dashboard", "/members", "/membersubscriptions", "/payments", "/expenses"]);
  assert.deepEqual(hrefs(groups[1].items), ["/reports", "/equipment", "/todos"]);
  assert.deepEqual(hrefs(groups[2].items), ["/gyms", "/locations", "/staff", "/profile"]);
});

test("staff only see pages they were given, plus Profile", () => {
  const items = hrefs(visibleNavItems("STAFF", ["members.view", "payments.view"]));
  assert.deepEqual(items, ["/members", "/payments", "/profile"]);
  assert.ok(!hrefs(visibleNavItems("STAFF", ["members.view"])).includes("/staff"), "staff never see Staff");
});

test("admins see platform pages and no gym-only pages", () => {
  const items = hrefs(visibleNavItems("SUPER_ADMIN"));
  assert.ok(items.includes("/clients"));
  assert.ok(!items.includes("/members"));
  assert.deepEqual(visibleNavItems(null), []);
  assert.deepEqual(visibleNavItems("MEMBER"), []);
});

test("menu names are plain and icons are distinct", () => {
  const titles = routeItems.map(i => i.title);
  assert.ok(titles.includes("Memberships") && titles.includes("To-dos"));
  assert.ok(!titles.includes("Member Subscriptions") && !titles.includes("Todos"));
  assert.equal(new Set(routeItems.map(i => i.icon)).size, routeItems.length, "each menu item has its own icon");
});

test("the phone tab bar holds at most four daily items", () => {
  const tabs = routeItems.filter(i => i.tab);
  assert.ok(tabs.length <= 4);
  assert.ok(tabs.every(i => i.group === "daily"));
});

test("navItemForPath finds the section, not a similar prefix", () => {
  assert.equal(navItemForPath("/members/manage")?.title, "Members");
  assert.equal(navItemForPath("/membersubscriptions")?.title, "Memberships");
  assert.equal(navItemForPath("/notifications"), undefined);
});

test("breadcrumbs name the section and the action", () => {
  assert.deepEqual(breadcrumbsFor("/members"), []);
  assert.deepEqual(breadcrumbsFor("/members/manage", "create"), [{ label: "Members", href: "/members" }, { label: "Add" }]);
  assert.deepEqual(breadcrumbsFor("/members/manage", "edit"), [{ label: "Members", href: "/members" }, { label: "Edit" }]);
  assert.deepEqual(breadcrumbsFor("/membersubscriptions/manage", "view"), [
    { label: "Memberships", href: "/membersubscriptions" },
    { label: "Details" },
  ]);
  assert.deepEqual(breadcrumbsFor("/members/import"), [{ label: "Members", href: "/members" }, { label: "Import" }]);
  assert.deepEqual(breadcrumbsFor("/notifications"), [{ label: "Notifications" }]);
});
