// pages/api/membersubscriptions/getmembersubscriptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import { summarizeBalance } from "@/lib/member-balance";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { memberIdsMatchingPhone, phoneSearchDigits } from "@/lib/members/phone-search";
import { requireAccess } from "@/lib/access";
import type { Prisma } from "@/prisma/generated/client";
import { gymSummarySelect, memberListUserSelect } from "@/lib/api-selects";

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
    const where: Prisma.MemberSubscriptionWhereInput = {
      is_deleted: false,
    };

    if (member_id) {
      where.member_id = member_id;
    }

    // Owners and staff: only subscriptions for their members (staff: their gym only)
    if (isGymOwner) {
      const gymId = access.staffGymId ?? gym_id;
      const phoneDigits = search?.trim() ? phoneSearchDigits(search) : null;
      const phoneMatches = phoneDigits ? await memberIdsMatchingPhone(phoneDigits, access.ownerId) : [];
      where.member = {
        gym: {
          // Always set for owners and staff; "" matches nothing if it ever isn't.
          owner_id: access.ownerId ?? "",
          is_deleted: false,
          ...(gymId ? { id: gymId } : {}),
        },
        ...(location_id ? { location_id } : {}),
        ...(search?.trim()
          ? {
              OR: [
                {
                  user: {
                    OR: [
                      { first_name: { contains: search.trim(), mode: "insensitive" } },
                      { last_name: { contains: search.trim(), mode: "insensitive" } },
                      { email: { contains: search.trim(), mode: "insensitive" } },
                      { phone_number: { contains: search.trim(), mode: "insensitive" } },
                    ],
                  },
                },
                // Phone numbers in any format: "0301 84" finds "+92301 84…".
                ...(phoneMatches.length ? [{ id: { in: phoneMatches } }] : []),
              ],
            }
          : {}),
      };
    }

    const [subscriptions, totalCount] = await Promise.all([
      prisma.memberSubscription.findMany({
        where,
        include: {
          member: {
            select: {
              id: true,
              user_id: true,
              gym_id: true,
              location_id: true,
              user: { select: memberListUserSelect },
              gym: { select: gymSummarySelect },
            },
          },
          // Only to work out the balance; not sent to the browser.
          payments: { select: { amount: true } },
          freezes: {
            orderBy: { start_date: "desc" },
            select: { id: true, start_date: true, end_date: true, days: true, reason: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.memberSubscription.count({ where }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: subscriptions.map(({ payments, ...s }) => ({ ...s, ...summarizeBalance(s, payments) })),
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


