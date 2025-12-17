// pages/api/clients/createclient.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { hashPassword } from "@/lib/authHelper";
import {
  calculateEndDate,
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
      first_name,
      last_name,
      phone_number,
      address,
      city,
      state,
      zip_code,
      country,
      date_of_birth,
      cnic,
      email,
      password,
      planId,
      billingModel, // "MONTHLY" or "YEARLY"
      // Payment fields
      amount,
      payment_method,
      transaction_id,
      payment_date,
      notes,
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !phone_number || !email || !password) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: first_name, last_name, phone_number, email, password",
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // If plan is provided, validate it
    let plan = null;
    let startDate = new Date();
    let endDate: Date | null = null;

    if (planId && billingModel) {
      // Validate plan exists
      plan = await prisma.plan.findUnique({
        where: {
          id: planId,
          is_deleted: false,
          is_active: true,
        },
      });

      if (!plan) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid plan",
        });
      }

      // Validate billing model
      if (billingModel !== "MONTHLY" && billingModel !== "YEARLY") {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid billing model. Must be MONTHLY or YEARLY",
        });
      }

      const billingModelEnum = billingModel as BillingModel;
      endDate = calculateEndDate(startDate, billingModelEnum);
    }

    // Create user, subscription, and payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const client = await tx.user.create({
        data: {
          first_name,
          last_name,
          phone_number,
          address,
          city,
          state,
          zip_code,
          country,
          date_of_birth: new Date(date_of_birth),
          cnic,
          email,
          password: hashedPassword,
          role: "GYM_OWNER",
        },
      });

      // If plan is provided, create OwnerSubscription record
      let ownerSubscription = null;
      if (plan && billingModel && endDate) {
        ownerSubscription = await tx.ownerSubscription.create({
          data: {
            plan_id: planId,
            owner_id: client.id,
            billing_model: billingModel as BillingModel,
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
              owner_subscription_id: ownerSubscription.id,
              subscription_type: SubscriptionTypeEnum.OWNER,
              amount: parseInt(amount),
              payment_method: payment_method as PaymentMethod,
              transaction_id: transaction_id || null,
              payment_date: payment_date ? new Date(payment_date) : new Date(),
              notes: notes || null,
            },
          });
        }
      }

      return { client, ownerSubscription };
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Client created successfully",
      data: result.client,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}
