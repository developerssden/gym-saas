// pages/api/subscription/activeSubscription.ts
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

  // Get current subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: id as string },
    select: { is_active: true },
  });

  if (!subscription) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Subscription not found" });
  }

  // Toggle the status
  const updated = await prisma.subscription.update({
    where: { id: id as string },
    data: {
      is_active: !subscription.is_active,
    },
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
