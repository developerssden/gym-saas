// pages/api/subscription/deleteSubscription.ts
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
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Subscription ID is required" });
    }

    const deleted = await prisma.ownerSubscription.update({
      where: { id: id as string },
      data: { is_deleted: true, is_active: false },
    });

    return res.status(StatusCodes.OK).json({
      message: "Subscription deleted successfully",
      deleted,
    });
  } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}
