'use client';

import { useSession } from 'next-auth/react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import { routeItems } from '@/contants/data';

type Role = 'SUPER_ADMIN' | 'GYM_OWNER' | 'MEMBER';

export function AppSidebar() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;

  const filteredItems = routeItems.filter(item => {
    if (!item.permissions.length) return true;
    if (!role) return false;
    return item.permissions.includes(role);
  });

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}