"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { routeItems } from "@/constants/data";
import { visibleNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Role = "SUPER_ADMIN" | "GYM_OWNER" | "MEMBER" | "STAFF";

/**
 * Whether the phone tab bar is showing: for owners and staff on menu pages.
 * Forms and other sub-pages hide it so their buttons aren't covered.
 */
export function useMobileTabBar(): boolean {
  const { data: session } = useSession();
  const pathname = usePathname() || "/";
  const role = session?.user?.role;
  return (role === "GYM_OWNER" || role === "STAFF") && routeItems.some((item) => item.href === pathname);
}

/**
 * Bottom tab bar on phones: the daily pages one tap away, and "Menu" for
 * everything else. Renders a spacer so page content isn't hidden behind it.
 */
export function MobileTabBar() {
  const { data: session } = useSession();
  const pathname = usePathname() || "/";
  const { setOpenMobile } = useSidebar();
  const visible = useMobileTabBar();
  if (!visible) return null;

  const tabs = visibleNavItems(session?.user?.role as Role, session?.user?.staff_permissions ?? []).filter(
    (item) => item.tab,
  );

  const tabClass =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium outline-none focus-visible:bg-accent";

  return (
    <>
      <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
      >
        <ul className="flex">
          {tabs.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="flex flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(tabClass, active ? "text-foreground" : "text-muted-foreground")}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-primary text-primary-foreground",
                    )}
                  >
                    <item.icon aria-hidden className="size-5" />
                  </span>
                  <span className="truncate">{item.title}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setOpenMobile(true)}
              className={cn(tabClass, "text-muted-foreground")}
              aria-haspopup="dialog"
            >
              <span className="flex h-7 w-12 items-center justify-center">
                <Menu aria-hidden className="size-5" />
              </span>
              Menu
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
