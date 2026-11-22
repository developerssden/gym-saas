"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/staff-permissions";

/**
 * What the signed-in user may do. Owners can do everything; staff only what
 * their owner ticked. The API enforces the same rules; this only hides UI.
 */
export function usePermissions() {
  const { data: session } = useSession();
  const user = session?.user;
  const role = user?.role;

  const can = useCallback((permission: string) => hasPermission(user, permission), [user]);

  return {
    can,
    isOwner: role === "GYM_OWNER",
    isStaff: role === "STAFF",
    /** Owner or staff: someone who works on a gym's data. */
    isGymUser: role === "GYM_OWNER" || role === "STAFF",
  };
}
