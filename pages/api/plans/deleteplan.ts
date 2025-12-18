// pages/api/plans/deletePlan.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Plan id is required" });
    }

    // If any user currently has an active (non-expired) subscription on this plan, block deletion
    const activeSubsCount = await prisma.ownerSubscription.count({
      where: {
        plan_id: id as string,
        is_deleted: false,
        is_active: true,
        is_expired: false,
      },
    });

    if (activeSubsCount > 0) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Plan cannot be deleted because it has active subscriptions",
      });
    }

    const deleted = await prisma.plan.update({
      where: { id: id as string },
      data: { is_deleted: true },
    });

    return res.status(StatusCodes.OK).json({
      message: "Plan deleted successfully",
      deleted,
    });
  } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}


