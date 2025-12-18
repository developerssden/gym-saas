import type { LucideIcon } from "lucide-react";
import {
  Building,
  CreditCard,
  Home,
  List,
  Map,
  Megaphone,
  Users,
} from "lucide-react";

type Role = "SUPER_ADMIN" | "GYM_OWNER" | "MEMBER";

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
    permissions: ["SUPER_ADMIN", "GYM_OWNER"],
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
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    permissions: ["SUPER_ADMIN"],
  },
  {
    title: "Gyms",
    href: "/gyms",
    icon: Building,
    permissions: ["SUPER_ADMIN"],
  },
  {
    title: "Locations",
    href: "/locations",
    icon: Map,
    permissions: ["SUPER_ADMIN"],
  },
  
  {
    title: "Plans",
    href: "/plans",
    icon: List,
    permissions: ["SUPER_ADMIN"],
  },
  {
    title: "Announcements",
    href: "/announcements",
    icon: Megaphone,
    permissions: ["SUPER_ADMIN"],
  },
];
