'use client';

import { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { GymLocationSwitcher } from '@/components/layout/gym-location-switcher';
import { groupNavItems, visibleNavItems } from '@/lib/navigation';

type Role = 'SUPER_ADMIN' | 'GYM_OWNER' | 'MEMBER' | 'STAFF';

export function AppSidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const role = session?.user?.role as Role | undefined;

  // The session callback only fills in the role for active accounts. A
  // signed-in session without one means the account was deactivated or
  // removed (e.g. an owner deactivated this staff member): sign out.
  useEffect(() => {
    if (status === 'authenticated' && !session?.user?.role) {
      signOut({ callbackUrl: '/sign-in' });
    }
  }, [status, session?.user?.role]);

  const groups = groupNavItems(visibleNavItems(role, session?.user?.staff_permissions ?? []));

  return (
    <Sidebar collapsible="icon">
      <GymLocationSwitcher />
      <SidebarContent>
        {groups.map(group => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => {
                  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={!!isActive} tooltip={item.title} className="md:h-8 h-11">
                        <Link
                          href={item.href}
                          aria-current={isActive ? 'page' : undefined}
                          // Close the phone menu after choosing a page.
                          onClick={() => isMobile && setOpenMobile(false)}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
