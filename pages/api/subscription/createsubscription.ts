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
  getPlanPrice,
} from "@/lib/subscription-helpers";
import { BillingModel, PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";

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
      // Payment fields (required for subscription creation)
      amount,
      payment_method,
      transaction_id,
      payment_date,
      notes,
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
      select: { id: true, name: true, monthly_price: true, yearly_price: true },
    });

    if (!plan) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid plan_id",
      });
    }

    // Validate payment details
    if (!payment_method) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: payment_method",
      });
    }

    if (payment_method !== "CASH" && payment_method !== "BANK_TRANSFER") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid payment_method. Must be CASH or BANK_TRANSFER",
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

      const subscription = await tx.ownerSubscription.create({
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

      // If amount is not provided, default to plan price for that billing model
      const computedAmount =
        amount !== undefined && amount !== null && String(amount).trim() !== ""
          ? parseInt(amount)
          : getPlanPrice(plan, billingModelEnum);

      if (!Number.isFinite(computedAmount) || computedAmount <= 0) {
        throw new Error("Invalid amount");
      }

      // Transaction rules:
      // - BANK_TRANSFER requires transaction_id
      // - CASH can auto-generate one if missing
      const method = payment_method as PaymentMethod;
      const txId =
        method === "BANK_TRANSFER"
          ? transaction_id
          : transaction_id || `CASH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      if (method === "BANK_TRANSFER" && !txId) {
        throw new Error("transaction_id is required for BANK_TRANSFER");
      }

      await tx.payment.create({
        data: {
          owner_subscription_id: subscription.id,
          subscription_type: SubscriptionTypeEnum.OWNER,
          amount: computedAmount,
          payment_method: method,
          transaction_id: txId || null,
          payment_date: payment_date ? new Date(payment_date) : new Date(),
          notes: notes || null,
        },
      });

      return subscription;
    });

    return res.status(StatusCodes.CREATED).json(created);
  } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}
