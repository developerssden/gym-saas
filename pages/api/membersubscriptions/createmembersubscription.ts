// pages/api/membersubscriptions/createmembersubscription.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { calculateEndDate } from "@/lib/subscription-helpers";
import { BillingModel, PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const {
      member_id,
      price,
      billing_model,
      start_date,
      // Payment fields
      amount,
      payment_method,
      transaction_id,
      payment_date,
      notes,
    } = req.body;

    // Validate required fields
    if (!member_id || !price || !billing_model) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: member_id, price, billing_model",
      });
    }

    // Validate billing model
    if (billing_model !== "MONTHLY" && billing_model !== "YEARLY") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid billing model. Must be MONTHLY or YEARLY",
      });
    }

    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: member_id },
    });

    if (!member) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Member not found",
      });
    }

    const startDate = start_date ? new Date(start_date) : new Date();
    const endDate = calculateEndDate(startDate, billing_model as BillingModel);

    // Create subscription and payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create MemberSubscription
      const memberSubscription = await tx.memberSubscription.create({
        data: {
          member_id,
          price: parseInt(price),
          billing_model: billing_model as BillingModel,
          start_date: startDate,
          end_date: endDate,
          is_expired: false,
          is_active: true,
        },
      });

      // Create payment record if payment details provided
      if (amount && payment_method) {
        await tx.payment.create({
          data: {
            member_subscription_id: memberSubscription.id,
            subscription_type: SubscriptionTypeEnum.MEMBER,
            amount: parseInt(amount),
            payment_method: payment_method as PaymentMethod,
            transaction_id: transaction_id || null,
            payment_date: payment_date ? new Date(payment_date) : new Date(),
            notes: notes || null,
          },
        });
      }

      return memberSubscription;
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Member subscription created successfully",
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}


