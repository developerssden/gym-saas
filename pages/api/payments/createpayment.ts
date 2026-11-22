// pages/api/payments/createpayment.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownsGym } from "@/lib/access";
import { PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";
import { parseMoney, summarizeBalance } from "@/lib/member-balance";
import { parseClientId, parseRecordedAt } from "@/lib/offline/request-fields";
import { answerIfReplayed, isClientIdConflict } from "@/lib/offline/payment-replay";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: "payments.record", allowAdmin: true });
  if (!access) return;

  const isGymOwner = !access.isAdmin;

  // Idempotency key and real payment time, sent by the app (also when syncing offline payments).
  const clientId = parseClientId(req.body?.client_id);
  const recordedAt = parseRecordedAt(req.body?.recorded_at);
  if (!clientId.ok) return res.status(StatusCodes.BAD_REQUEST).json({ error: clientId.error });
  if (!recordedAt.ok) return res.status(StatusCodes.BAD_REQUEST).json({ error: recordedAt.error });

  try {
    if (await answerIfReplayed(res, clientId.value, access.userId)) return;

    const {
      owner_subscription_id,
      member_subscription_id,
      subscription_type,
      amount,
      payment_method,
      transaction_id,
      payment_date,
      notes,
    } = req.body;

    // Validate required fields
    if (!amount || !payment_method || !subscription_type) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error:
          "Missing required fields: amount, payment_method, subscription_type",
      });
    }

    const paymentAmount = parseMoney(amount, Number.NaN);
    if (!Number.isInteger(paymentAmount) || paymentAmount <= 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Amount must be a whole number greater than 0",
      });
    }

    // Validate subscription type and corresponding subscription ID
    if (
      subscription_type === SubscriptionTypeEnum.OWNER &&
      !owner_subscription_id
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "owner_subscription_id is required for OWNER subscription type",
      });
    }

    if (
      subscription_type === SubscriptionTypeEnum.MEMBER &&
      !member_subscription_id
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error:
          "member_subscription_id is required for MEMBER subscription type",
      });
    }

    // Verify subscription exists and belongs to owner (for GYM_OWNER)
    if (subscription_type === SubscriptionTypeEnum.OWNER) {
      const ownerSubscription = await prisma.ownerSubscription.findUnique({
        where: { id: owner_subscription_id },
        include: { owner: true },
      });

      if (!ownerSubscription) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Owner subscription not found",
        });
      }

      // For GYM_OWNER: verify they own this subscription
      // Staff never record owner (platform) payments.
      if (isGymOwner && (access.isStaff || ownerSubscription.owner_id !== access.ownerId)) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: "Forbidden – You can only create payments for your own subscriptions",
        });
      }
    } else {
      const memberSubscription = await prisma.memberSubscription.findUnique({
        where: { id: member_subscription_id },
        include: {
          member: {
            include: {
              gym: true,
            },
          },
          payments: { select: { amount: true } },
        },
      });

      if (!memberSubscription) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Member subscription not found",
        });
      }

      // For GYM_OWNER: verify member belongs to their gym
      if (!ownsGym(access, memberSubscription.member.gym)) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: "Forbidden – You can only create payments for your members' subscriptions",
        });
      }

      // A member payment can't be more than what's still owed.
      const { balance } = summarizeBalance(memberSubscription, memberSubscription.payments);
      if (balance <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "This subscription is already fully paid",
        });
      }
      if (paymentAmount > balance) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: `Amount can't be more than the remaining balance (${balance})`,
        });
      }
    }

    // Create payment
    // Transaction rules:
    // - BANK_TRANSFER requires transaction_id
    // - CASH can auto-generate one if missing
    const method = payment_method as PaymentMethod;
    const txId =
      method === "BANK_TRANSFER"
        ? transaction_id
        : transaction_id ||
          `CASH-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    if (method === "BANK_TRANSFER" && !txId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "transaction_id is required for BANK_TRANSFER",
      });
    }

    const payment = await prisma.payment.create({
      data: {
        owner_subscription_id:
          subscription_type === SubscriptionTypeEnum.OWNER
            ? owner_subscription_id
            : null,
        member_subscription_id:
          subscription_type === SubscriptionTypeEnum.MEMBER
            ? member_subscription_id
            : null,
        subscription_type: subscription_type as SubscriptionTypeEnum,
        amount: paymentAmount,
        payment_method: method,
        transaction_id: txId || null,
        payment_date: recordedAt.value ?? (payment_date ? new Date(payment_date) : new Date()),
        notes: notes || null,
        recorded_by_id: access.userId,
        client_id: clientId.value,
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Payment created successfully",
      data: payment,
    });
  } catch (err: unknown) {
    // Same payment sent twice at once: the other request saved it.
    if (isClientIdConflict(err) && (await answerIfReplayed(res, clientId.value, access.userId))) return;
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}
