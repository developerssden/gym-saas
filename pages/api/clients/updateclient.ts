// pages/api/clients/updateclient.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { hashPassword } from "@/lib/authHelper";
import {
  calculateEndDate,
  calculateEndDateWithRemainingDays,
  calculateRemainingDaysFromEndDate,
  deactivateOwnerSubscriptions,
} from "@/lib/subscription-helpers";
import { BillingModel, PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const {
      id,
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
      billingModel,
      isRenewal,
      // Payment fields
      amount,
      payment_method,
      transaction_id,
      payment_date,
      notes,
    } = req.body;

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Client ID is required",
      });
    }

    // Check if client exists
    const existingClient = await prisma.user.findUnique({
      where: { id, is_deleted: false, role: "GYM_OWNER" },
      include: {
        ownerSubscriptions: {
          where: { is_deleted: false, is_active: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!existingClient) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Client not found",
      });
    }

    // Update user and subscription in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Prepare user update data
      const userUpdateData: any = {
        first_name,
        last_name,
        phone_number,
        address,
        city,
        state,
        zip_code,
        country,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : undefined,
        cnic,
        email,
      };

      // Update password if provided
      if (password) {
        userUpdateData.password = await hashPassword(password);
      }

      // Update user
      const client = await tx.user.update({
        where: { id },
        data: userUpdateData,
      });

      // Handle subscription update/renewal
      if (planId && billingModel) {
        // Validate plan exists
        const plan = await tx.plan.findUnique({
          where: {
            id: planId,
            is_deleted: false,
            is_active: true,
          },
        });

        if (!plan) {
          throw new Error("Invalid plan");
        }

        // Validate billing model
        if (billingModel !== "MONTHLY" && billingModel !== "YEARLY") {
          throw new Error("Invalid billing model. Must be MONTHLY or YEARLY");
        }

        const billingModelEnum = billingModel as BillingModel;
        const startDate = new Date();

        // Calculate end date
        let endDate: Date;
        if (isRenewal && existingClient.ownerSubscriptions.length > 0) {
          // Renewal: add remaining days from previous subscription
          const previousSubscription = existingClient.ownerSubscriptions[0];
          const remainingDays = calculateRemainingDaysFromEndDate(previousSubscription.end_date);
          endDate = calculateEndDateWithRemainingDays(startDate, billingModelEnum, remainingDays);
          
          // Deactivate previous subscriptions
          await deactivateOwnerSubscriptions(tx, id);
        } else {
          // Update: use new start date
          endDate = calculateEndDate(startDate, billingModelEnum);
          
          // Deactivate previous subscriptions if updating
          if (existingClient.ownerSubscriptions.length > 0) {
            await deactivateOwnerSubscriptions(tx, id);
          }
        }

        // Create new OwnerSubscription
        const ownerSubscription = await tx.ownerSubscription.create({
          data: {
            plan_id: planId,
            owner_id: id,
            billing_model: billingModelEnum,
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

        return { client, ownerSubscription };
      }

      return { client };
    });

    return res.status(StatusCodes.OK).json({
      message: "Client updated successfully",
      data: result.client,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}
