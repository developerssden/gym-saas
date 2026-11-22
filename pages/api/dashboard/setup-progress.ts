// GET /api/dashboard/setup-progress: what a new gym owner has set up so far,
// for the dashboard setup checklist. Owners only.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { SubscriptionTypeEnum } from "@/prisma/generated/client";
import type { SetupProgress } from "@/lib/setup-checklist";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  // No permission: staff are refused, the checklist is the owner's.
  const access = await requireAccess(req, res);
  if (!access?.ownerId) return;
  const ownerId = access.ownerId;

  try {
    const gym = { owner_id: ownerId, is_deleted: false };
    const [gyms, locations, members, payments, pushSubscriptions] = await Promise.all([
      prisma.gym.count({ where: gym }),
      prisma.location.count({ where: { is_deleted: false, gym } }),
      prisma.member.count({ where: { gym } }),
      prisma.payment.count({
        where: { subscription_type: SubscriptionTypeEnum.MEMBER, memberSubscription: { member: { gym } } },
      }),
      prisma.pushSubscription.count({ where: { user_id: access.userId } }),
    ]);

    const progress: SetupProgress = {
      gym: gyms > 0,
      location: locations > 0,
      members: members > 0,
      payment: payments > 0,
      notifications: pushSubscriptions > 0,
    };
    return res.status(StatusCodes.OK).json(progress);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
