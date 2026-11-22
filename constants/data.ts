import type { LucideIcon } from "lucide-react";
import {
  Building,
  CreditCard,
  Home,
  List,
  Map,
  Megaphone,
  Users,
  CheckSquare,
  Package,
  Inbox,
  Receipt,
  UserCog,
} from "lucide-react";

type Role = "SUPER_ADMIN" | "GYM_OWNER" | "MEMBER" | "STAFF";

export type RouteItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permissions: Role[];
};

export const routeItems: RouteItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
    permissions: ["SUPER_ADMIN", "GYM_OWNER", "STAFF"],
  },
  {
    title: "Clients",
    href: "/clients",
    icon: Users,
    permissions: ["SUPER_ADMIN"],
  },
  {
    title: "Subscriptions",
    href: "/subscriptions",
    icon: CreditCard,
    permissions: ["SUPER_ADMIN"],
  },
  {
    title: "Gyms",
    href: "/gyms",
    icon: Building,
    permissions: ["SUPER_ADMIN","GYM_OWNER"],
  },
  {
    title: "Locations",
    href: "/locations",
    icon: Map,
    permissions: ["SUPER_ADMIN","GYM_OWNER"],
  },
  {
    title: "Members",
    href: "/members",
    icon: Users,
    permissions: ["GYM_OWNER", "STAFF"],
  },
  {
    title: "Member Subscriptions",
    href: "/membersubscriptions",
    icon: CreditCard,
    permissions: ["GYM_OWNER", "STAFF"],
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    permissions: ["SUPER_ADMIN", "GYM_OWNER", "STAFF"],
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: Receipt,
    permissions: ["GYM_OWNER", "STAFF"],
  },
  {
    title: "Plans",
    href: "/plans",
    icon: List,
    permissions: ["SUPER_ADMIN"],
  },
  {
    title: "Registrations",
    href: "/registrations",
    icon: Inbox,
    permissions: ["SUPER_ADMIN"],
  },
  {
    title: "Announcements",
    href: "/announcements",
    icon: Megaphone,
    permissions: ["SUPER_ADMIN"],
  },
  {
    title: "Todos",
    href: "/todos",
    icon: CheckSquare,
    permissions: ["GYM_OWNER", "STAFF"],
  },
  {
    title: "Equipment",
    href: "/equipment",
    icon: Package,
    permissions: ["GYM_OWNER", "STAFF"],
  },
  {
    title: "Staff",
    href: "/staff",
    icon: UserCog,
    permissions: ["GYM_OWNER"],
  },
];
