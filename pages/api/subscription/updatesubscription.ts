// pages/api/subscription/updateSubscription.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { BillingModel, PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";
import { calculateEndDate, getPlanPrice } from "@/lib/subscription-helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { id } = req.body;
    const {
      plan_id,
      billing_model,
      start_date,
      end_date,
      is_active,
      is_expired,
      is_deleted,
      // Optional: if provided, we will also create a new payment record linked to this subscription.
      amount,
      payment_method,
      transaction_id,
      payment_date,
      notes,
    } = req.body;

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Subscription ID is required" });
    }

    const existing = await prisma.ownerSubscription.findUnique({
      where: { id: id as string },
      include: { plan: true },
    });

    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Subscription not found" });
    }

    // Validate billing model if provided
    if (billing_model !== undefined) {
      if (billing_model !== "MONTHLY" && billing_model !== "YEARLY") {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid billing_model. Must be MONTHLY or YEARLY",
        });
      }
    }

    // Validate plan if provided
    if (plan_id !== undefined) {
      const plan = await prisma.plan.findUnique({
        where: {
          id: plan_id as string,
          is_deleted: false,
          is_active: true,
        },
        select: { id: true },
      });
      if (!plan) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid plan_id" });
      }
    }

    const updateData: any = {};
    if (plan_id !== undefined) updateData.plan_id = plan_id as string;
    if (billing_model !== undefined) updateData.billing_model = billing_model as BillingModel;
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);
    if (is_expired !== undefined) updateData.is_expired = Boolean(is_expired);
    if (is_deleted !== undefined) updateData.is_deleted = Boolean(is_deleted);

    if (start_date !== undefined) {
      updateData.start_date = new Date(start_date);
    }

    if (end_date !== undefined) {
      updateData.end_date = new Date(end_date);
    }

    // If start_date or billing_model changed and end_date not explicitly provided, recalc end_date
    const nextStartDate: Date = updateData.start_date ?? existing.start_date;
    const nextBillingModel: BillingModel =
      (updateData.billing_model ?? existing.billing_model) as BillingModel;
    if ((start_date !== undefined || billing_model !== undefined) && end_date === undefined) {
      updateData.end_date = calculateEndDate(nextStartDate, nextBillingModel);
    }

    const shouldRecordPayment = payment_method !== undefined || amount !== undefined;

    // If payment fields are present, validate upfront and then do update+payment atomically.
    if (shouldRecordPayment) {
      if (!payment_method) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "payment_method is required when recording a payment",
        });
      }

      if (payment_method !== "CASH" && payment_method !== "BANK_TRANSFER") {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid payment_method. Must be CASH or BANK_TRANSFER",
        });
      }

      const method = payment_method as PaymentMethod;

      const updated = await prisma.$transaction(async (tx) => {
        const sub = await tx.ownerSubscription.update({
          where: { id: id as string },
          data: updateData,
          include: { plan: true, owner: true },
        });

        // Amount: if not provided, default to current plan price for current billing model
        const computedAmount =
          amount !== undefined && amount !== null && String(amount).trim() !== ""
            ? parseInt(amount)
            : getPlanPrice(sub.plan, sub.billing_model as BillingModel);

        if (!Number.isFinite(computedAmount) || computedAmount <= 0) {
          throw new Error("Invalid amount");
        }

        // Transaction rules:
        // - BANK_TRANSFER requires transaction_id
        // - CASH can auto-generate one if missing
        const txId =
          method === "BANK_TRANSFER"
            ? transaction_id
            : transaction_id ||
              `CASH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

        if (method === "BANK_TRANSFER" && !txId) {
          throw new Error("transaction_id is required for BANK_TRANSFER");
        }

        await tx.payment.create({
          data: {
            owner_subscription_id: sub.id,
            subscription_type: SubscriptionTypeEnum.OWNER,
            amount: computedAmount,
            payment_method: method,
            transaction_id: txId || null,
            payment_date: payment_date ? new Date(payment_date) : new Date(),
            notes: notes || null,
          },
        });

        return sub;
      });

      return res.status(StatusCodes.OK).json(updated);
    }

    const updated = await prisma.ownerSubscription.update({
      where: { id: id as string },
      data: updateData,
      include: { plan: true, owner: true },
    });

    return res.status(StatusCodes.OK).json(updated);
  } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: message });
}
}
