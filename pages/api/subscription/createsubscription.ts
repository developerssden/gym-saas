// pages/api/subscription/createSubscription.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import {
  calculateEndDate,
  calculateEndDateWithRemainingDays,
  calculateRemainingDaysFromEndDate,
  deactivateOwnerSubscriptions,
} from "@/lib/subscription-helpers";
import { BillingModel } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const {
      plan_id,
      owner_id,
      billing_model,
      start_date,
      end_date,
    } = req.body;

    if (!plan_id || !owner_id || !billing_model) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: plan_id, owner_id, billing_model",
      });
    }

    if (billing_model !== "MONTHLY" && billing_model !== "YEARLY") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid billing_model. Must be MONTHLY or YEARLY",
      });
    }

    // Validate owner exists and is a gym owner
    const owner = await prisma.user.findUnique({
      where: {
        id: owner_id as string,
        is_deleted: false,
        role: "GYM_OWNER",
      },
      select: { id: true },
    });

    if (!owner) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid owner_id",
      });
    }

    // Validate plan exists and is active
    const plan = await prisma.plan.findUnique({
      where: {
        id: plan_id as string,
        is_deleted: false,
        is_active: true,
      },
      select: { id: true },
    });

    if (!plan) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid plan_id",
      });
    }

    const billingModelEnum = billing_model as BillingModel;
    const startDate = start_date ? new Date(start_date) : new Date();

    const existingActive = await prisma.ownerSubscription.findFirst({
      where: {
        owner_id: owner_id as string,
        is_deleted: false,
        is_active: true,
        is_expired: false,
      },
      orderBy: { createdAt: "desc" },
    });

    const remainingDays = existingActive
      ? calculateRemainingDaysFromEndDate(existingActive.end_date)
      : 0;

    // Base end date can be provided by caller, otherwise we compute it from billing model
    const baseEndDate = end_date
      ? new Date(end_date)
      : calculateEndDate(startDate, billingModelEnum);

    // Final end date always includes rollover remaining days (if any)
    const finalEndDate =
      end_date !== undefined
        ? (() => {
            const extended = new Date(baseEndDate);
            if (remainingDays > 0) extended.setDate(extended.getDate() + remainingDays);
            return extended;
          })()
        : calculateEndDateWithRemainingDays(startDate, billingModelEnum, remainingDays);

    const created = await prisma.$transaction(async (tx) => {
      if (existingActive) {
        await deactivateOwnerSubscriptions(tx, owner_id as string);
      }

      return tx.ownerSubscription.create({
        data: {
          plan_id: plan_id as string,
          owner_id: owner_id as string,
          billing_model: billingModelEnum,
          start_date: startDate,
          end_date: finalEndDate,
          is_expired: false,
          is_active: true,
        },
        include: {
          plan: true,
          owner: true,
        },
      });
    });

    return res.status(StatusCodes.CREATED).json(created);
  } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}
