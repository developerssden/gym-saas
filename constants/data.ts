import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Briefcase,
  Building2,
  CreditCard,
  Dumbbell,
  FileBarChart,
  IdCard,
  Inbox,
  Layers,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Megaphone,
  Receipt,
  Store,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";

type Role = "SUPER_ADMIN" | "GYM_OWNER" | "MEMBER" | "STAFF";

/** Menu sections, in the order they're shown. */
export const NAV_GROUPS = [
  { id: "daily", label: "Daily" },
  { id: "business", label: "Business" },
  { id: "platform", label: "Platform" },
  { id: "settings", label: "Settings" },
] as const;

export type NavGroupId = (typeof NAV_GROUPS)[number]["id"];

export type RouteItem = {
  /** Menu name. Must match the page's title. */
  title: string;
  href: string;
  icon: LucideIcon;
  permissions: Role[];
  group: NavGroupId;
  /** Also in the bottom tab bar on phones (owners and staff). */
  tab?: boolean;
};

// Order inside each group is the order in the menu: most used first.
export const routeItems: RouteItem[] = [
  // Daily: the counter work.
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permissions: ["SUPER_ADMIN", "GYM_OWNER", "STAFF"],
    group: "daily",
    tab: true,
  },
  {
    title: "Members",
    href: "/members",
    icon: Users,
    permissions: ["GYM_OWNER", "STAFF"],
    group: "daily",
    tab: true,
  },
  {
    title: "Memberships",
    href: "/membersubscriptions",
    icon: IdCard,
    permissions: ["GYM_OWNER", "STAFF"],
    group: "daily",
    tab: true,
  },
  {
    title: "Payments",
    href: "/payments",
    icon: Banknote,
    permissions: ["SUPER_ADMIN", "GYM_OWNER", "STAFF"],
    group: "daily",
    tab: true,
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: Receipt,
    permissions: ["GYM_OWNER", "STAFF"],
    group: "daily",
  },

  // Business: looking back and looking after the gym.
  {
    title: "Reports",
    href: "/reports",
    icon: FileBarChart,
    permissions: ["GYM_OWNER", "STAFF"],
    group: "business",
  },
  {
    title: "Equipment",
    href: "/equipment",
    icon: Dumbbell,
    permissions: ["GYM_OWNER", "STAFF"],
    group: "business",
  },
  {
    title: "To-dos",
    href: "/todos",
    icon: ListTodo,
    permissions: ["GYM_OWNER", "STAFF"],
    group: "business",
  },

  // Platform: super admin only.
  {
    title: "Clients",
    href: "/clients",
    icon: Briefcase,
    permissions: ["SUPER_ADMIN"],
    group: "platform",
  },
  {
    title: "Owner subscriptions",
    href: "/subscriptions",
    icon: CreditCard,
    permissions: ["SUPER_ADMIN"],
    group: "platform",
  },
  {
    title: "Plans",
    href: "/plans",
    icon: Layers,
    permissions: ["SUPER_ADMIN"],
    group: "platform",
  },
  {
    title: "Registrations",
    href: "/registrations",
    icon: Inbox,
    permissions: ["SUPER_ADMIN"],
    group: "platform",
  },
  {
    title: "Announcements",
    href: "/announcements",
    icon: Megaphone,
    permissions: ["SUPER_ADMIN"],
    group: "platform",
  },

  // Settings: set up once, rarely changed.
  // Owners: their gym, its branches and plan usage on one page.
  {
    title: "My gym",
    href: "/my-gym",
    icon: Store,
    permissions: ["GYM_OWNER"],
    group: "settings",
  },
  // Admins: every gym and location on the platform.
  {
    title: "Gyms",
    href: "/gyms",
    icon: Building2,
    permissions: ["SUPER_ADMIN"],
    group: "settings",
  },
  {
    title: "Locations",
    href: "/locations",
    icon: MapPin,
    permissions: ["SUPER_ADMIN"],
    group: "settings",
  },
  {
    title: "Staff",
    href: "/staff",
    icon: UserCog,
    permissions: ["GYM_OWNER"],
    group: "settings",
  },
  {
    title: "Profile",
    href: "/profile",
    icon: UserRound,
    permissions: ["SUPER_ADMIN", "GYM_OWNER", "STAFF"],
    group: "settings",
  },
];
