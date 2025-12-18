// pages/api/subscription/renewSubscription.ts
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

/**
 * Renew an OWNER subscription using the same owner + plan.
 *
 * - Finds the owner's current active (non-deleted) subscription (or by subscription_id if provided)
 * - Uses renew_date (or now) as new start_date
 * - Calculates end_date from billing model
 * - Adds remaining days from previous subscription onto the new end date (same behavior as other renew flows)
 * - Deactivates previous active subscriptions, then creates a new OwnerSubscription
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const {
      owner_id,
      subscription_id,
      renew_date,
      billing_model,
      // Payment fields (required for renew)
      amount,
      payment_method,
      transaction_id,
      payment_date,
      notes,
    } = req.body as {
      owner_id?: string;
      subscription_id?: string;
      renew_date?: string | Date;
      billing_model?: BillingModel | "MONTHLY" | "YEARLY";
      amount?: string | number;
      payment_method?: PaymentMethod | "CASH" | "BANK_TRANSFER";
      transaction_id?: string;
      payment_date?: string | Date;
      notes?: string;
    };

    if (!owner_id && !subscription_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: owner_id (or subscription_id)",
      });
    }

    if (billing_model !== undefined && billing_model !== "MONTHLY" && billing_model !== "YEARLY") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid billing_model. Must be MONTHLY or YEARLY",
      });
    }

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

    const existingSubscription = subscription_id
      ? await prisma.ownerSubscription.findUnique({
          where: { id: subscription_id },
          include: { owner: true, plan: true },
        })
      : await prisma.ownerSubscription.findFirst({
          where: {
            owner_id: owner_id as string,
            is_deleted: false,
            is_active: true,
          },
          orderBy: { createdAt: "desc" },
          include: { owner: true, plan: true },
        });

    if (!existingSubscription || existingSubscription.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Active subscription not found",
      });
    }

    // If owner_id was provided, ensure it matches the subscription we found (safety)
    if (owner_id && existingSubscription.owner_id !== owner_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "owner_id does not match subscription owner",
      });
    }

    // Determine billing model: caller can override, otherwise keep existing
    const billingModelEnum = (billing_model ?? existingSubscription.billing_model) as BillingModel;

    const startDate = renew_date ? new Date(renew_date) : new Date();
    if (Number.isNaN(startDate.getTime())) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid renew_date",
      });
    }

    const remainingDays = calculateRemainingDaysFromEndDate(existingSubscription.end_date);
    const endDate =
      remainingDays > 0
        ? calculateEndDateWithRemainingDays(startDate, billingModelEnum, remainingDays)
        : calculateEndDate(startDate, billingModelEnum);

    const created = await prisma.$transaction(async (tx) => {
      await deactivateOwnerSubscriptions(tx, existingSubscription.owner_id);

      const subscription = await tx.ownerSubscription.create({
        data: {
          owner_id: existingSubscription.owner_id,
          plan_id: existingSubscription.plan_id,
          billing_model: billingModelEnum,
          start_date: startDate,
          end_date: endDate,
          is_expired: false,
          is_active: true,
        },
        include: {
          owner: true,
          plan: true,
        },
      });

      const computedAmount =
        amount !== undefined && amount !== null && String(amount).trim() !== ""
          ? parseInt(amount as any)
          : getPlanPrice(existingSubscription.plan, billingModelEnum);

      if (!Number.isFinite(computedAmount) || computedAmount <= 0) {
        throw new Error("Invalid amount");
      }

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

    return res.status(StatusCodes.CREATED).json({
      message: "Owner subscription renewed successfully",
      data: created,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}


