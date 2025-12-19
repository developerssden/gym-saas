// pages/api/membersubscriptions/getmembersubscriptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const isGymOwner = session.user.role === "GYM_OWNER";

  try {
    const {
      member_id,
      page = 1,
      limit = 10,
    } = req.body;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      is_deleted: false,
    };

    if (member_id) {
      where.member_id = member_id;
    }

    // For GYM_OWNER: only show subscriptions for their members
    if (isGymOwner) {
      where.member = {
        gym: {
          owner_id: session.user.id,
          is_deleted: false,
        },
      };
    }

    const [subscriptions, totalCount] = await Promise.all([
      prisma.memberSubscription.findMany({
        where,
        include: {
          member: {
            include: {
              user: true,
              gym: true,
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.memberSubscription.count({ where }),
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


