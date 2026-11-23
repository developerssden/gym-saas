// Permission catalogue for staff logins. Pure module: safe to import from
// client components, API routes and proxy.ts.
//
// Each staff account stores a list of keys like "members.create". Gym owners
// implicitly have every permission; staff have only what their owner ticked.

export type PermissionAction = {
  key: string;
  label: string;
  description?: string;
};

export type PermissionPage = {
  /** Section id, also the first part of every key in it ("members"). */
  id: string;
  label: string;
  /** Page routes this section controls; needs `<id>.view` to open them. */
  routes: string[];
  actions: PermissionAction[];
};

export const PERMISSION_PAGES: PermissionPage[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    routes: ["/dashboard"],
    actions: [
      { key: "dashboard.view", label: "View dashboard", description: "Member counts, expiring fees and recent activity" },
      { key: "dashboard.revenue", label: "See revenue and profit", description: "Revenue, expenses and profit figures and charts" },
    ],
  },
  {
    id: "members",
    label: "Members",
    routes: ["/members"],
    actions: [
      { key: "members.view", label: "View members" },
      { key: "members.create", label: "Add members" },
      { key: "members.edit", label: "Edit members" },
      { key: "members.delete", label: "Delete members" },
      { key: "members.import", label: "Bulk import members" },
    ],
  },
  {
    id: "membersubscriptions",
    label: "Memberships",
    routes: ["/membersubscriptions"],
    actions: [
      { key: "membersubscriptions.view", label: "View subscriptions" },
      { key: "membersubscriptions.create", label: "Create subscriptions" },
      { key: "membersubscriptions.edit", label: "Edit subscriptions" },
      { key: "membersubscriptions.renew", label: "Renew subscriptions" },
      { key: "membersubscriptions.freeze", label: "Freeze / unfreeze" },
      { key: "membersubscriptions.delete", label: "Delete subscriptions" },
      { key: "membersubscriptions.whatsapp", label: "WhatsApp reminders and receipts" },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    routes: ["/payments"],
    actions: [
      { key: "payments.view", label: "View payments list" },
      { key: "payments.record", label: "Record payments", description: "Take fees and print receipts" },
    ],
  },
  {
    id: "expenses",
    label: "Expenses",
    routes: ["/expenses"],
    actions: [
      { key: "expenses.view", label: "View expenses" },
      { key: "expenses.create", label: "Record expenses" },
      { key: "expenses.edit", label: "Edit expenses" },
      { key: "expenses.delete", label: "Delete expenses" },
      { key: "expenses.cashbook", label: "See cash book and profit" },
    ],
  },
  {
    id: "equipment",
    label: "Equipment",
    routes: ["/equipment"],
    actions: [
      { key: "equipment.view", label: "View equipment" },
      { key: "equipment.create", label: "Add equipment" },
      { key: "equipment.edit", label: "Edit equipment" },
      { key: "equipment.delete", label: "Delete equipment" },
    ],
  },
  {
    id: "todos",
    label: "To-dos",
    routes: ["/todos"],
    actions: [
      { key: "todos.view", label: "View to-dos" },
      { key: "todos.create", label: "Add to-dos" },
      { key: "todos.edit", label: "Edit / complete to-dos" },
      { key: "todos.delete", label: "Delete to-dos" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    routes: ["/reports"],
    actions: [
      { key: "reports.view", label: "View and download monthly reports", description: "Includes collected fees, expenses and profit" },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_PAGES.flatMap(p =>
  p.actions.map(a => a.key)
);

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Ticked by default when an owner invites a new staff member. */
export const DEFAULT_STAFF_PERMISSIONS: string[] = [
  "dashboard.view",
  "members.view",
  "members.create",
  "members.edit",
  "membersubscriptions.view",
  "membersubscriptions.create",
  "membersubscriptions.edit",
  "membersubscriptions.renew",
  "membersubscriptions.freeze",
  "membersubscriptions.whatsapp",
  "payments.view",
  "payments.record",
  "expenses.view",
  "expenses.create",
  "equipment.view",
  "equipment.create",
  "equipment.edit",
  "todos.view",
  "todos.create",
  "todos.edit",
];

/** Keeps only known keys, drops duplicates, and adds `<page>.view` for any page with another action ticked. */
export function normalizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const wanted = new Set(input.filter((k): k is string => typeof k === "string"));
  const result = new Set<string>();
  for (const page of PERMISSION_PAGES) {
    const keys = page.actions.map(a => a.key).filter(k => wanted.has(k));
    if (keys.length === 0) continue;
    result.add(`${page.id}.view`);
    keys.forEach(k => result.add(k));
  }
  return ALL_PERMISSIONS.filter(k => result.has(k));
}

/** Roles that work on a gym's data: owners (everything) and staff (their permissions). */
export function hasPermission(
  user: { role?: string | null; staff_permissions?: string[] | null } | null | undefined,
  permission: string
): boolean {
  if (!user) return false;
  if (user.role === "GYM_OWNER") return true;
  if (user.role === "STAFF") return (user.staff_permissions ?? []).includes(permission);
  return false;
}

/**
 * Permissions that open a page route for staff (any one is enough), or null
 * when the route isn't staff-controllable. `/x/manage?action=create|edit|view`
 * is the record form and `/members/import` is bulk import; everything else
 * needs view.
 */
export function permissionsForPath(pathname: string, action?: string | null): string[] | null {
  for (const page of PERMISSION_PAGES) {
    const base = page.routes.find(r => pathname === r || pathname.startsWith(`${r}/`));
    if (!base) continue;
    const rest = pathname.slice(base.length);
    if (page.id === "payments" && (rest === "/manage" || rest.startsWith("/manage/"))) {
      return ["payments.record"];
    }
    if (rest === "/manage" || rest.startsWith("/manage/")) {
      if (action === "view") return [`${page.id}.view`];
      if (action === "edit") return [`${page.id}.edit`];
      if (action === "create") return [`${page.id}.create`];
      return [`${page.id}.create`, `${page.id}.edit`];
    }
    if (page.id === "members" && (rest === "/import" || rest.startsWith("/import/"))) {
      return ["members.import"];
    }
    return [`${page.id}.view`];
  }
  return null;
}

/** First page a staff member can open, for redirects after sign-in. */
export function firstAllowedPath(permissions: string[] | null | undefined): string {
  const have = new Set(permissions ?? []);
  const page = PERMISSION_PAGES.find(p => have.has(`${p.id}.view`));
  return page ? page.routes[0] : "/profile";
}
