// pages/api/subscription/getSubscriptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { Prisma } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { page = 1, limit = 10, search = "" } = req.body;
    const skip = (page - 1) * limit;

    const or = [];

    if (search) {
      or.push({ name: { contains: search, mode: "insensitive" } });
    }

    const whereClause = {
      is_deleted: false,
    };

    const [subscriptions, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: subscriptions,
      totalCount,
      pageCount: Math.ceil(totalCount / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}
