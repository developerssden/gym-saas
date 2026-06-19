// pages/api/plans/createPlan.ts
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
      max_locations,
      max_members,
      max_equipment,
      polar_product_id,
      polar_checkout_url_monthly,
      polar_checkout_url_yearly,
    } = req.body;

    const plan = await prisma.plan.create({
      data: {
        name,
        monthly_price,
        yearly_price,
        max_gyms,
        max_locations,
        max_members,
        max_equipment,
        polar_product_id: polar_product_id || null,
        polar_checkout_url_monthly: polar_checkout_url_monthly || null,
        polar_checkout_url_yearly: polar_checkout_url_yearly || null,
      },
    });

    return res.status(StatusCodes.CREATED).json(plan);
  } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}


