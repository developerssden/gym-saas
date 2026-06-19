import prisma from "@/lib/prisma";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const plans = await prisma.plan.findMany({
    where: { is_active: true, is_deleted: false },
    select: {
      id: true,
      name: true,
      monthly_price: true,
      yearly_price: true,
      max_gyms: true,
      max_locations: true,
      max_members: true,
      max_equipment: true,
      polar_product_id: true,
      polar_checkout_url_monthly: true,
      polar_checkout_url_yearly: true,
    },
    orderBy: { monthly_price: "asc" },
  });

  return res.status(200).json({ plans });
}
