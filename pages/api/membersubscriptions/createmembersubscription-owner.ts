// pages/api/membersubscriptions/createmembersubscription-owner.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
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
      // Payment fields (optional - will default if not provided)
      payment_method,
      transaction_id,
      payment_date,
      notes,
    } = req.body as {
      member_id: string;
      price: number;
      months?: number;
      start_date?: string;
      end_date?: string;
      use_custom_dates: boolean;
      payment_method?: string;
      transaction_id?: string;
      payment_date?: string;
      notes?: string;
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

    // Calculate dates based on use_custom_dates flag
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
    }

    // Default payment method to CASH if not provided
    const finalPaymentMethod = (payment_method as PaymentMethod) || PaymentMethod.CASH;
    
    // Generate transaction ID for CASH if not provided
    const finalTransactionId =
      finalPaymentMethod === PaymentMethod.BANK_TRANSFER
        ? transaction_id || null
        : transaction_id ||
          `CASH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // Validate BANK_TRANSFER requires transaction_id
    if (finalPaymentMethod === PaymentMethod.BANK_TRANSFER && !finalTransactionId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "transaction_id is required for BANK_TRANSFER",
      });
    }

    // Create MemberSubscription and Payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create MemberSubscription
      const memberSubscription = await tx.memberSubscription.create({
        data: {
          member_id,
          price: parseInt(String(price)),
          billing_model: "MONTHLY", // Default, can be adjusted if needed
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
          payment_method: finalPaymentMethod,
          transaction_id: finalTransactionId,
          payment_date: payment_date ? new Date(payment_date) : new Date(),
          notes: notes || null,
        },
      });

      return memberSubscription;
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Member subscription and payment created successfully",
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

