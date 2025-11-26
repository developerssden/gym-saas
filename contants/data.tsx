import type { LucideIcon } from 'lucide-react';
import { Calendar, Home, Inbox, Search, Settings } from 'lucide-react';

type Role = 'SUPER_ADMIN' | 'GYM_OWNER' | 'MEMBER';

export type RouteItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permissions: Role[];
};

export const routeItems: RouteItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    permissions: ['SUPER_ADMIN', 'GYM_OWNER']
  },
  {
    title: 'Inbox',
    href: '/inbox',
    icon: Inbox,
    permissions: ['GYM_OWNER']
  },
  {
    title: 'Calendar',
    href: '/calendar',
    icon: Calendar,
    permissions: ['GYM_OWNER']
  },
  {
    title: 'Search',
    href: '/search',
    icon: Search,
    permissions: ['GYM_OWNER']
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    permissions: ['GYM_OWNER']
  }
];

