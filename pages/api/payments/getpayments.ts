// pages/api/payments/getpayments.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import {
  gymSummarySelect,
  locationSummarySelect,
  memberListUserSelect,
  ownerSummarySelect,
  recordedBySelect,
} from "@/lib/api-selects";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownedGymWhere } from "@/lib/access";
import { memberIdsMatchingPhone, phoneSearchDigits } from "@/lib/members/phone-search";
import { memberPaymentSearchWhere, ownerPaymentSearchWhere } from "@/lib/payments/payment-search";
import { Prisma, SubscriptionTypeEnum } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: ["payments.view", "membersubscriptions.view"], allowAdmin: true });
  if (!access) return;

  const isGymOwner = !access.isAdmin;

  try {
    const {
      owner_subscription_id,
      member_subscription_id,
      subscription_type,
      page = 1,
      limit = 10,
      search,
      gym_id,
      location_id,
    } = req.body;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.PaymentWhereInput = {};

    // Owners and staff: only payments for their members' subscriptions (not their
    // own owner subscriptions), in the selected branch. Staff always stay in
    // their own gym, whatever gym_id the client sends.
    if (isGymOwner) {
      const gymId = access.staffGymId ?? (typeof gym_id === "string" && gym_id ? gym_id : undefined);
      where.member_subscription_id =
        subscription_type === SubscriptionTypeEnum.MEMBER && member_subscription_id
          ? member_subscription_id
          : { not: null };
      where.memberSubscription = {
        member: {
          gym: { ...ownedGymWhere(access), is_deleted: false, ...(gymId ? { id: gymId } : {}) },
          ...(typeof location_id === "string" && location_id ? { location_id } : {}),
        },
      };
      // Phone numbers in any format: "0301 84" finds "+92301 84…".
      const digits = typeof search === "string" ? phoneSearchDigits(search) : null;
      const phoneMemberIds = digits ? await memberIdsMatchingPhone(digits, access.ownerId) : [];
      const searchWhere = memberPaymentSearchWhere(search, phoneMemberIds);
      if (searchWhere) where.AND = [searchWhere];
    } else {
      // SUPER_ADMIN: only show payments for gym owners' subscriptions (owner subscription payments)
      if (subscription_type === SubscriptionTypeEnum.OWNER && owner_subscription_id) {
        where.owner_subscription_id = owner_subscription_id;
      } else {
        where.owner_subscription_id = { not: null };
      }
      const searchWhere = ownerPaymentSearchWhere(search);
      if (searchWhere) where.AND = [searchWhere];
    }

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          recordedBy: { select: recordedBySelect },
          ownerSubscription: {
            select: {
              id: true,
              owner_id: true,
              plan_id: true,
              billing_model: true,
              start_date: true,
              end_date: true,
              plan: { select: { id: true, name: true } },
              owner: { select: ownerSummarySelect },
            },
          },
          memberSubscription: {
            select: {
              id: true,
              member_id: true,
              price: true,
              billing_model: true,
              start_date: true,
              end_date: true,
              member: {
                select: {
                  id: true,
                  user: { select: memberListUserSelect },
                  gym: { select: gymSummarySelect },
                  location: { select: locationSummarySelect },
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


