'use client';

import { useSession } from 'next-auth/react';
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

type Role = 'SUPER_ADMIN' | 'GYM_OWNER' | 'MEMBER';

export function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role as Role | undefined;

  const filteredItems = routeItems.filter(item => {
    if (!item.permissions.length) return true;
    if (!role) return false;
    return item.permissions.includes(role);
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
