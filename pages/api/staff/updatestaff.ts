// pages/api/staff/updatestaff.ts
// Owner changes a staff member's permissions, gym or name, or deactivates /
// reactivates the account.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { normalizePermissions } from "@/lib/staff-permissions";
import { STAFF_SELECT, findOwnedStaff, staffStatus } from "@/lib/staff";
import { checkLimitExceeded, validateOwnerSubscription } from "@/lib/subscription-validation";
import type { Prisma } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res);
  if (!access) return;
  const ownerId = access.ownerId!;

  try {
    const { id, permissions, gym_id, first_name, last_name, is_active } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || !id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Staff ID is required" });
    }

    const staff = await findOwnedStaff(ownerId, id);
    if (!staff) return res.status(StatusCodes.NOT_FOUND).json({ error: "Staff member not found" });

    const data: Prisma.UserUpdateInput = {};

    if (permissions !== undefined) {
      data.staff_permissions = normalizePermissions(permissions);
    }

    if (gym_id !== undefined && gym_id !== staff.staff_gym_id) {
      if (typeof gym_id !== "string" || !gym_id) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid gym" });
      }
      const gym = await prisma.gym.findFirst({
        where: { id: gym_id, owner_id: ownerId, is_deleted: false },
        select: { id: true },
      });
      if (!gym) {
        return res.status(StatusCodes.FORBIDDEN).json({ error: "Gym not found or does not belong to you" });
      }
      data.staff_gym = { connect: { id: gym.id } };
    }

    if (first_name !== undefined) {
      const firstName = typeof first_name === "string" ? first_name.trim() : "";
      if (!firstName) return res.status(StatusCodes.BAD_REQUEST).json({ error: "First name is required" });
      data.first_name = firstName;
    }
    if (last_name !== undefined) {
      data.last_name = typeof last_name === "string" && last_name.trim() ? last_name.trim() : null;
    }

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "is_active must be true or false" });
      }
      if (!staff.onboarding_completed) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "This person hasn't accepted their invite yet. Resend or cancel the invite instead.",
        });
      }
      // Reactivating takes a seat back, and needs an active plan.
      if (is_active && !staff.is_active) {
        const validation = await validateOwnerSubscription(ownerId);
        if (!validation.isActive) {
          return res.status(StatusCodes.FORBIDDEN).json({
            error: "SUBSCRIPTION_EXPIRED",
            message: "Your plan isn't active, so you can't reactivate staff. Contact support to renew.",
          });
        }
        const seats = await checkLimitExceeded(ownerId, "staff");
        if (seats.exceeded) {
          return res.status(StatusCodes.CONFLICT).json({
            error: "LIMIT_EXCEEDED",
            resourceType: "staff",
            current: seats.current,
            max: seats.max,
            message: `Staff limit reached (max ${seats.max} on your plan).`,
          });
        }
      }
      data.is_active = is_active;
    }

    const updated = await prisma.user.update({
      where: { id: staff.id },
      data,
      select: STAFF_SELECT,
    });

    return res.status(StatusCodes.OK).json({
      message: "Staff member updated",
      data: { ...updated, status: staffStatus(updated) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
