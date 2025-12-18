// pages/api/plans/activePlan.ts
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

  // Get current plan
  const plan = await prisma.plan.findUnique({
    where: { id: id as string },
    select: { is_active: true },
  });

  if (!plan) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Plan not found" });
  }

  // If this request would deactivate the plan, block it when there are active subscriptions
  if (plan.is_active) {
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
        message: "Plan cannot be deactivated because it has active subscriptions",
      });
    }
  }

  // Toggle the status
  const updated = await prisma.plan.update({
    where: { id: id as string },
    data: {
      is_active: !plan.is_active,
    },
  });

  return res.status(StatusCodes.OK).json({
    message: updated.is_active
      ? "Plan activated"
      : "Plan deactivated",
    plan: updated,
  });

}  catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}


