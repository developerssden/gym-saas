// pages/api/membersubscriptions/renewmembersubscription-owner.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import {
  calculateRemainingDaysFromEndDate,
} from "@/lib/subscription-helpers";
import { PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
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
    if (member.gym.owner_id !== session.user.id) {
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

      finalStartDate = new Date(); // Current date
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
          price: parseInt(String(price)),
          billing_model: "MONTHLY", // Default
          start_date: finalStartDate,
          end_date: finalEndDate,
          is_expired: false,
          is_active: true,
        },
      });

      // Automatically create payment record
      await tx.payment.create({
        data: {
          member_subscription_id: memberSubscription.id,
          subscription_type: SubscriptionTypeEnum.MEMBER,
          amount: parseInt(String(price)),
          payment_method: paymentMethod,
          transaction_id: transactionId,
          payment_date: req.body.payment_date ? new Date(req.body.payment_date) : new Date(),
          notes: req.body.notes || null,
        },
      });

      return memberSubscription;
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Member subscription renewed and payment created successfully",
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

