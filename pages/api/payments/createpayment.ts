// pages/api/payments/createpayment.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";
import { PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" });

  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const isGymOwner = session.user.role === "GYM_OWNER";

  try {
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
      if (isGymOwner && ownerSubscription.owner_id !== session.user.id) {
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
        },
      });

      if (!memberSubscription) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Member subscription not found",
        });
      }

      // For GYM_OWNER: verify member belongs to their gym
      if (isGymOwner && memberSubscription.member.gym.owner_id !== session.user.id) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: "Forbidden – You can only create payments for your members' subscriptions",
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
        amount: parseInt(amount),
        payment_method: method,
        transaction_id: txId || null,
        payment_date: payment_date ? new Date(payment_date) : new Date(),
        notes: notes || null,
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Payment created successfully",
      data: payment,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}
