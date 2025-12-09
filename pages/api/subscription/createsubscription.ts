// pages/api/subscription/createSubscription.ts
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
    const {
      name,
      monthly_price,
      yearly_price,
      max_gyms,
      max_members,
      max_equipment,
    } = req.body;

    const subscription = await prisma.subscription.create({
      data: {
        name,
        monthly_price,
        yearly_price,
        max_gyms,
        max_members,
        max_equipment,
      },
    });

    return res.status(StatusCodes.CREATED).json(subscription);
  } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}
