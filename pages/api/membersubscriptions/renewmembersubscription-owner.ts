// pages/api/membersubscriptions/renewmembersubscription-owner.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownsGym } from "@/lib/access";
import {
  calculateRemainingDaysFromEndDate,
} from "@/lib/subscription-helpers";
import { PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";
import { amountDue, parseMoney, validateFeeInput } from "@/lib/member-balance";
import { parseClientId, parseRecordedAt } from "@/lib/offline/request-fields";
import { answerIfReplayed, isClientIdConflict } from "@/lib/offline/payment-replay";
import { getDaysUntilExpiration } from "@/lib/date-utils";
import { EXPIRING_SOON_DAYS } from "@/lib/dashboard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: "membersubscriptions.renew" });
  if (!access) return;

  // Idempotency key and real time of the renewal, sent by the app (also when syncing offline).
  const clientId = parseClientId(req.body?.client_id);
  const recordedAt = parseRecordedAt(req.body?.recorded_at);
  if (!clientId.ok) return res.status(StatusCodes.BAD_REQUEST).json({ error: clientId.error });
  if (!recordedAt.ok) return res.status(StatusCodes.BAD_REQUEST).json({ error: recordedAt.error });

  try {
    // Before the "already active" check: a replayed renewal finds the new subscription active.
    if (await answerIfReplayed(res, clientId.value, access.userId)) return;

    const {
      member_id,
      price,
      months,
      start_date,
      end_date,
      use_custom_dates,
    } = req.body as {
      member_id: string;
      price: number;
      months?: number;
      start_date?: string;
      end_date?: string;
      use_custom_dates: boolean;
    };

    // Validate required fields
    if (!member_id || !price) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: member_id, price",
      });
    }

    const fee = {
      price: parseMoney(price, Number.NaN),
      discount: parseMoney(req.body.discount, 0),
      admission_fee: parseMoney(req.body.admission_fee, 0),
    };
    // Paid now; defaults to the full amount due. 0 = pay later.
    const paidNow = parseMoney(req.body.amount_paid, amountDue(fee));
    const feeError = validateFeeInput({ ...fee, amount_paid: paidNow });
    if (feeError) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: feeError });
    }
    const discountNote =
      fee.discount > 0 && typeof req.body.discount_note === "string"
        ? req.body.discount_note.trim() || null
        : null;

    // Verify member exists and belongs to owner
    const member = await prisma.member.findUnique({
      where: { id: member_id },
      include: {
        gym: true,
      },
    });

    if (!member) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Member not found",
      });
    }

    // Verify member belongs to owner's gym
    if (!ownsGym(access, { id: member.gym_id, owner_id: member.gym.owner_id })) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – Member does not belong to your gym",
      });
    }

    // Get existing active subscription to calculate remaining days
    const existingSubscription = await prisma.memberSubscription.findFirst({
      where: {
        member_id,
        is_deleted: false,
        is_active: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Renew in the last EXPIRING_SOON_DAYS (7) days or once it has ended; days left are carried over below.
    if (existingSubscription?.frozen_since) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "This membership is frozen. Unfreeze it before renewing.",
      });
    }
    if (
      existingSubscription?.is_active &&
      !existingSubscription.is_expired &&
      getDaysUntilExpiration(existingSubscription.end_date) > EXPIRING_SOON_DAYS
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: `This membership is still running. You can renew it in the last ${EXPIRING_SOON_DAYS} days.`,
      });
    }

    let finalStartDate: Date;
    let finalEndDate: Date;

    if (use_custom_dates) {
      // Custom dates: require start_date and end_date
      if (!start_date || !end_date) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Missing required fields: start_date and end_date (when use_custom_dates is true)",
        });
      }

      finalStartDate = new Date(start_date);
      finalEndDate = new Date(end_date);

      // Validate dates
      if (isNaN(finalStartDate.getTime()) || isNaN(finalEndDate.getTime())) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid date format",
        });
      }

      if (finalEndDate <= finalStartDate) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "End date must be after start date",
        });
      }

      // Add remaining days from previous subscription if exists
      if (existingSubscription) {
        const remainingDays = calculateRemainingDaysFromEndDate(existingSubscription.end_date);
        if (remainingDays > 0) {
          finalEndDate.setDate(finalEndDate.getDate() + remainingDays);
        }
      }
    } else {
      // Months-based: require months
      if (!months || months <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Missing or invalid field: months (when use_custom_dates is false)",
        });
      }

      // When it was renewed (offline renewals sync later), else now.
      finalStartDate = recordedAt.value ? new Date(recordedAt.value) : new Date();
      finalEndDate = new Date(finalStartDate);
      finalEndDate.setMonth(finalEndDate.getMonth() + months);

      // Add remaining days from previous subscription if exists
      if (existingSubscription) {
        const remainingDays = calculateRemainingDaysFromEndDate(existingSubscription.end_date);
        if (remainingDays > 0) {
          finalEndDate.setDate(finalEndDate.getDate() + remainingDays);
        }
      }
    }

    // Default payment method to CASH if not provided
    const paymentMethod = (req.body.payment_method as PaymentMethod) || PaymentMethod.CASH;
    
    // Generate transaction ID for CASH if not provided
    const transactionId =
      paymentMethod === PaymentMethod.BANK_TRANSFER
        ? req.body.transaction_id || null
        : req.body.transaction_id ||
          `CASH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // Validate BANK_TRANSFER requires transaction_id
    if (paymentMethod === PaymentMethod.BANK_TRANSFER && !transactionId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "transaction_id is required for BANK_TRANSFER",
      });
    }

    // Deactivate previous subscription and create new one with payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deactivate previous subscription if exists
      if (existingSubscription) {
        await tx.memberSubscription.update({
          where: { id: existingSubscription.id },
          data: { is_active: false },
        });
      }

      // Create new MemberSubscription
      const memberSubscription = await tx.memberSubscription.create({
        data: {
          member_id,
          price: fee.price,
          discount: fee.discount,
          discount_note: discountNote,
          admission_fee: fee.admission_fee,
          // Keep a yearly member yearly; anything else stays monthly as before.
          billing_model: req.body.billing_model === "YEARLY" ? "YEARLY" : "MONTHLY",
          start_date: finalStartDate,
          end_date: finalEndDate,
          is_expired: false,
          is_active: true,
        },
      });

      // Record what was paid now (nothing when the member pays later)
      const payment = paidNow <= 0 ? null : await tx.payment.create({
        data: {
          member_subscription_id: memberSubscription.id,
          subscription_type: SubscriptionTypeEnum.MEMBER,
          amount: paidNow,
          payment_method: paymentMethod,
          transaction_id: transactionId,
          payment_date: recordedAt.value ?? (req.body.payment_date ? new Date(req.body.payment_date) : new Date()),
          notes: req.body.notes || null,
          recorded_by_id: access.userId,
          client_id: clientId.value,
        },
      });

      return { memberSubscription, paymentId: payment?.id ?? null };
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Member subscription renewed and payment created successfully",
      data: result.memberSubscription,
      /** For sharing the receipt; null when nothing was paid now. */
      payment_id: result.paymentId,
    });
  } catch (err: unknown) {
    // Same renewal sent twice at once: the transaction rolled back, the other one saved it.
    if (isClientIdConflict(err) && (await answerIfReplayed(res, clientId.value, access.userId))) return;
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

