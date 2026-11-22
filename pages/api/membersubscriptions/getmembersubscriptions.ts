// pages/api/membersubscriptions/getmembersubscriptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import { summarizeBalance } from "@/lib/member-balance";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess } from "@/lib/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, {
    permission: ["membersubscriptions.view", "payments.record"],
    allowAdmin: true,
  });
  if (!access) return;

  const isGymOwner = !access.isAdmin;

  try {
    const {
      member_id,
      page = 1,
      limit = 10,
      search,
      gym_id,
      location_id,
    } = req.body;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      is_deleted: false,
    };

    if (member_id) {
      where.member_id = member_id;
    }

    // Owners and staff: only subscriptions for their members (staff: their gym only)
    if (isGymOwner) {
      const gymId = access.staffGymId ?? gym_id;
      where.member = {
        gym: {
          owner_id: access.ownerId,
          is_deleted: false,
          ...(gymId ? { id: gymId } : {}),
        },
        ...(location_id ? { location_id } : {}),
        ...(search?.trim()
          ? {
              user: {
                OR: [
                  { first_name: { contains: search.trim(), mode: "insensitive" } },
                  { last_name: { contains: search.trim(), mode: "insensitive" } },
                  { email: { contains: search.trim(), mode: "insensitive" } },
                ],
              },
            }
          : {}),
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
            include: {
              recordedBy: { select: { id: true, first_name: true, last_name: true, role: true } },
            },
          },
          freezes: {
            orderBy: { start_date: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.memberSubscription.count({ where }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: subscriptions.map((s) => ({ ...s, ...summarizeBalance(s, s.payments) })),
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


