// API access for gym data, shared by gym owners and their staff.
//
// Owners can do everything on their own gyms. Staff act on their owner's
// data, only in their assigned gym, and only with the permissions their
// owner ticked. Every gym-data API route should call requireAccess() and
// scope its queries by `access.ownerId` (never `session.user.id`, which is
// the staff member's own id).
import type { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { StatusCodes } from "http-status-codes";
import { options } from "@/pages/api/auth/[...nextauth]";
import { hasPermission } from "@/lib/staff-permissions";

export type Access = {
  session: Session;
  /** The signed-in user (owner, staff member or admin). Use for "recorded by". */
  userId: string;
  role: "SUPER_ADMIN" | "GYM_OWNER" | "STAFF";
  isAdmin: boolean;
  isStaff: boolean;
  /** Whose gyms this request works on. Null only for SUPER_ADMIN. */
  ownerId: string | null;
  /** STAFF only: the one gym they may touch. */
  staffGymId: string | null;
};

type Options = {
  /** Permission key a staff member needs (owners always pass). Omit to deny staff. */
  permission?: string | string[];
  /** Also let SUPER_ADMIN through (routes that admins used before). */
  allowAdmin?: boolean;
};

/**
 * Checks the session for an owner (or allowed staff/admin). Sends the error
 * response and returns null when access is refused.
 */
export async function requireAccess(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: Options = {}
): Promise<Access | null> {
  let session: Session | null;
  try {
    session = await getServerSession(req, res, options);
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Session validation failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  if (!session?.user?.id) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized – No session found" });
    return null;
  }

  const role = session.user.role;
  const forbid = (message = "Forbidden – You don't have access to this") => {
    res.status(StatusCodes.FORBIDDEN).json({ message });
    return null;
  };

  if (role === "SUPER_ADMIN") {
    if (!opts.allowAdmin) return forbid();
    return {
      session,
      userId: session.user.id,
      role,
      isAdmin: true,
      isStaff: false,
      ownerId: null,
      staffGymId: null,
    };
  }

  if (role === "GYM_OWNER") {
    return {
      session,
      userId: session.user.id,
      role,
      isAdmin: false,
      isStaff: false,
      ownerId: session.user.id,
      staffGymId: null,
    };
  }

  if (role === "STAFF") {
    const ownerId = session.user.staff_owner_id ?? null;
    const staffGymId = session.user.staff_gym_id ?? null;
    if (!ownerId || !staffGymId) return forbid("Forbidden – Your staff account is not linked to a gym");

    const needed = opts.permission === undefined ? [] : [opts.permission].flat();
    if (needed.length === 0) return forbid();
    // Any one of the listed permissions is enough.
    if (!needed.some(p => hasPermission(session!.user, p))) return forbid();

    return {
      session,
      userId: session.user.id,
      role,
      isAdmin: false,
      isStaff: true,
      ownerId,
      staffGymId,
    };
  }

  return forbid();
}

/**
 * For endpoints about the signed-in user's own account (profile, password,
 * push): lets owners and staff through, and admins when `allowAdmin`.
 * Scope queries by `session.user.id`.
 */
export async function requireOwnAccount(
  req: NextApiRequest,
  res: NextApiResponse,
  { allowAdmin = false }: { allowAdmin?: boolean } = {}
): Promise<Session | null> {
  let session: Session | null;
  try {
    session = await getServerSession(req, res, options);
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Session validation failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  if (!session?.user?.id) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized – No session found" });
    return null;
  }
  const allowed = ["GYM_OWNER", "STAFF", ...(allowAdmin ? ["SUPER_ADMIN"] : [])];
  if (!allowed.includes(session.user.role)) {
    res.status(StatusCodes.FORBIDDEN).json({ message: "Forbidden" });
    return null;
  }
  return session;
}

/** True when this access may work on the given gym (staff: only their own). */
export function canUseGym(access: Access, gymId: string | null | undefined): boolean {
  if (!access.isStaff) return true;
  return !!gymId && gymId === access.staffGymId;
}

/**
 * True when a record's gym belongs to this access: the owner's gym, and for
 * staff also their assigned gym. Admins pass everything.
 */
export function ownsGym(
  access: Access,
  gym: { id: string; owner_id: string; is_deleted?: boolean } | null | undefined
): boolean {
  if (access.isAdmin) return true;
  if (!gym || gym.is_deleted) return false;
  return gym.owner_id === access.ownerId && canUseGym(access, gym.id);
}

/**
 * Prisma `where` for the Gym model: the owner's gyms, or the staff member's
 * one gym. Combine it with other conditions through `AND: [ownedGymWhere(a)]`
 * so a request's own `id`/`gym_id` can't override the staff restriction.
 * Only for owners and staff (not SUPER_ADMIN).
 */
export function ownedGymWhere(access: Access): { owner_id: string; id?: string } {
  return {
    owner_id: access.ownerId ?? "__none__",
    ...(access.staffGymId ? { id: access.staffGymId } : {}),
  };
}

/**
 * Prisma `where` fragment for a model with a `gym` relation, limiting rows to
 * this access's gyms. Empty for SUPER_ADMIN.
 */
export function gymScope(access: Access): {
  gym?: { owner_id: string; is_deleted: false; id?: string };
} {
  if (access.isAdmin || !access.ownerId) return {};
  return { gym: { ...ownedGymWhere(access), is_deleted: false } };
}

/** Whether the signed-in user has a permission (owners and admins: always). */
export function can(access: Access, permission: string): boolean {
  if (!access.isStaff) return true;
  return hasPermission(access.session.user, permission);
}
