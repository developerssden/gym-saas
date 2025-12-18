// pages/api/subscription/activeSubscription.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { deactivateOwnerSubscriptions } from "@/lib/subscription-helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
  const { id } = req.body;
  if (!id) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Subscription ID is required" });
  }

  // Get current subscription
  const subscription = await prisma.ownerSubscription.findUnique({
    where: { id: id as string },
    select: { id: true, is_active: true, owner_id: true, is_deleted: true },
  });

  if (!subscription || subscription.is_deleted) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Subscription not found" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextActive = !subscription.is_active;

    // If activating one, deactivate all other active subscriptions for this owner first
    if (nextActive) {
      await deactivateOwnerSubscriptions(tx, subscription.owner_id);
    }

    return tx.ownerSubscription.update({
      where: { id: id as string },
      data: { is_active: nextActive },
    });
  });

  return res.status(StatusCodes.OK).json({
    message: updated.is_active
      ? "Subscription activated"
      : "Subscription deactivated",
    subscription: updated,
  });

}  catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}
