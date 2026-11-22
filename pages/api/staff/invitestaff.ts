// pages/api/staff/invitestaff.ts
// Owner invites a staff member by email to one of their gyms.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { normalizePermissions } from "@/lib/staff-permissions";
import { STAFF_SELECT, sendStaffInvite, staffStatus } from "@/lib/staff";
import { checkLimitExceeded, validateOwnerSubscription } from "@/lib/subscription-validation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res);
  if (!access) return;
  const ownerId = access.ownerId!;

  try {
    const { email, first_name, last_name, gym_id, permissions } = (req.body ?? {}) as Record<string, unknown>;

    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    const firstName = typeof first_name === "string" ? first_name.trim() : "";
    const lastName = typeof last_name === "string" ? last_name.trim() : "";

    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "A valid email is required" });
    }
    if (!firstName) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "First name is required" });
    }
    if (typeof gym_id !== "string" || !gym_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Choose the gym this staff member works at" });
    }

    const gym = await prisma.gym.findFirst({
      where: { id: gym_id, owner_id: ownerId, is_deleted: false },
      select: { id: true, name: true },
    });
    if (!gym) {
      return res.status(StatusCodes.FORBIDDEN).json({ error: "Gym not found or does not belong to you" });
    }

    const validation = await validateOwnerSubscription(ownerId);
    if (!validation.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "SUBSCRIPTION_EXPIRED",
        message: "Subscription is expired or inactive",
      });
    }

    const seats = await checkLimitExceeded(ownerId, "staff");
    if (seats.exceeded) {
      return res.status(StatusCodes.CONFLICT).json({
        error: "LIMIT_EXCEEDED",
        resourceType: "staff",
        current: seats.current,
        max: seats.max,
        message: `Staff limit reached (max ${seats.max} on your plan). Deactivate someone or upgrade your plan.`,
      });
    }

    const existing = await prisma.user.findFirst({
      where: { email: normalizedEmail, is_deleted: false },
      select: { id: true },
    });
    if (existing) {
      return res.status(StatusCodes.CONFLICT).json({ error: "An account with this email already exists" });
    }

    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { first_name: true, last_name: true },
    });

    const staff = await prisma.user.create({
      data: {
        email: normalizedEmail,
        first_name: firstName,
        last_name: lastName || null,
        role: "STAFF",
        is_active: false,
        onboarding_completed: false,
        staff_owner_id: ownerId,
        staff_gym_id: gym.id,
        staff_permissions: normalizePermissions(permissions),
      },
      select: STAFF_SELECT,
    });

    await sendStaffInvite({ id: staff.id, email: normalizedEmail }, owner ?? { first_name: null, last_name: null }, gym.name);

    return res.status(StatusCodes.CREATED).json({
      message: "Invite sent",
      data: { ...staff, status: staffStatus(staff) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
