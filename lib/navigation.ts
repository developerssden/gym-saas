// Which menu items a user sees, grouped, and what the header/breadcrumb call a page.
import { NAV_GROUPS, routeItems, type RouteItem } from "@/constants/data";
import { permissionsForPath } from "@/lib/staff-permissions";

type Role = "SUPER_ADMIN" | "GYM_OWNER" | "MEMBER" | "STAFF";

/** Menu items this user may open. Staff only see pages their owner gave them. */
export function visibleNavItems(role: Role | null | undefined, staffPermissions: string[] = []): RouteItem[] {
  if (!role) return [];
  return routeItems.filter(item => {
    if (!item.permissions.includes(role)) return false;
    if (role !== "STAFF") return true;
    const needed = permissionsForPath(item.href);
    // Pages outside the permission catalogue (e.g. Profile) are open to every signed-in user.
    return !needed || needed.some(p => staffPermissions.includes(p));
  });
}

/** Items split into the menu's sections, dropping empty ones. */
export function groupNavItems(items: RouteItem[]) {
  return NAV_GROUPS.map(group => ({ ...group, items: items.filter(i => i.group === group.id) })).filter(
    g => g.items.length > 0,
  );
}

/** The menu item a path belongs to ("/members/manage" → Members), if any. */
export function navItemForPath(pathname: string): RouteItem | undefined {
  return routeItems.find(item => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

const ACTION_LABELS: Record<string, string> = { create: "Add", edit: "Edit", view: "Details" };
const SEGMENT_LABELS: Record<string, string> = { import: "Import", manage: "Details" };

const titleCase = (s: string) => s.replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());

export type Crumb = { label: string; href?: string };

/** The record a page is about ("Ali Khan", linking to his profile), set by the page. */
export type CrumbEntity = { label: string; href?: string };

/** Database ids in paths (uuids, cuids): never shown as text. */
const isId = (segment: string) => /^[0-9a-f-]{20,}$/i.test(segment) || /^c[a-z0-9]{20,}$/.test(segment);

/**
 * Breadcrumb for a page below a menu page: "Members › Add", "Members › Import",
 * "Members › Ali Khan", "Members › Ali Khan › Edit" (when the page names its
 * record). Empty for menu pages themselves, whose title is already the heading.
 */
export function breadcrumbsFor(pathname: string, action?: string | null, entity?: CrumbEntity | null): Crumb[] {
  const section = navItemForPath(pathname);
  if (!section) {
    const last = pathname.split("/").filter(Boolean).pop();
    return last && !isId(last) ? [{ label: titleCase(last) }] : [];
  }
  if (pathname === section.href) return [];
  const rest = pathname.slice(section.href.length).split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: section.title, href: section.href }];
  for (const [i, segment] of rest.entries()) {
    const isLast = i === rest.length - 1;
    if (isId(segment)) {
      crumbs.push({ label: entity?.label ?? "Details", href: isLast ? undefined : entity?.href });
    } else if (isLast && segment === "manage" && action && ACTION_LABELS[action]) {
      // Editing or viewing a named record: "Members › Ali Khan › Edit".
      if (entity && action !== "create") crumbs.push({ label: entity.label, href: entity.href });
      crumbs.push({ label: ACTION_LABELS[action] });
    } else {
      crumbs.push({ label: SEGMENT_LABELS[segment] ?? titleCase(segment) });
    }
  }
  return crumbs;
}
