'use client';

import { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { GymLocationSwitcher } from '@/components/layout/gym-location-switcher';
import { routeItems } from '@/constants/data';
import Link from 'next/link';

import { permissionsForPath } from '@/lib/staff-permissions';

type Role = 'SUPER_ADMIN' | 'GYM_OWNER' | 'MEMBER' | 'STAFF';

export function AppSidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role as Role | undefined;
  const granted = session?.user?.staff_permissions ?? [];

  // The session callback only fills in the role for active accounts. A
  // signed-in session without one means the account was deactivated or
  // removed (e.g. an owner deactivated this staff member): sign out.
  useEffect(() => {
    if (status === 'authenticated' && !session?.user?.role) {
      signOut({ callbackUrl: '/sign-in' });
    }
  }, [status, session?.user?.role]);

  const filteredItems = routeItems.filter(item => {
    if (!item.permissions.length) return true;
    if (!role) return false;
    if (!item.permissions.includes(role)) return false;
    // Staff only see pages their owner gave them.
    if (role === 'STAFF') {
      const needed = permissionsForPath(item.href);
      return !needed || needed.some(p => granted.includes(p));
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <GymLocationSwitcher />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map(item => {
                const isActive =
                  pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={!!isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
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
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
