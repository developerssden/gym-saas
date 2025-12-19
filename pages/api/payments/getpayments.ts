// pages/api/payments/getpayments.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";
import { SubscriptionTypeEnum } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const isGymOwner = session.user.role === "GYM_OWNER";

  try {
    const {
      owner_subscription_id,
      member_subscription_id,
      subscription_type,
      page = 1,
      limit = 10,
    } = req.body;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // For GYM_OWNER: only show payments for their MEMBERS' subscriptions (not their own owner subscriptions)
    if (isGymOwner) {
      // GYM_OWNER should only see member subscription payments
      if (subscription_type === SubscriptionTypeEnum.MEMBER && member_subscription_id) {
        // Specific member subscription
        where.member_subscription_id = member_subscription_id;
        where.memberSubscription = {
          member: {
            gym: {
              owner_id: session.user.id,
              is_deleted: false,
            },
          },
        };
      } else {
        // All member subscription payments for their members
        where.member_subscription_id = {
          not: null,
        };
        where.memberSubscription = {
          member: {
            gym: {
              owner_id: session.user.id,
              is_deleted: false,
            },
          },
        };
      }
    } else {
      // SUPER_ADMIN: only show payments for gym owners' subscriptions (owner subscription payments)
      if (subscription_type === SubscriptionTypeEnum.OWNER && owner_subscription_id) {
        where.owner_subscription_id = owner_subscription_id;
      } else {
        // Show all owner subscription payments (gym owners' payments)
        where.owner_subscription_id = {
          not: null,
        };
      }
    }

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          ownerSubscription: {
            include: {
              plan: true,
              owner: true,
            },
          },
          memberSubscription: {
            include: {
              member: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: payments,
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


