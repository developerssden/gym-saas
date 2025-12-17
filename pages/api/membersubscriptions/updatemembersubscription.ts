// pages/api/membersubscriptions/updatemembersubscription.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { calculateEndDate } from "@/lib/subscription-helpers";
import { BillingModel } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const {
      id,
      price,
      billing_model,
      start_date,
      is_active,
      is_expired,
    } = req.body;

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Subscription ID is required",
      });
    }

    // Check if subscription exists
    const existingSubscription = await prisma.memberSubscription.findUnique({
      where: { id },
    });

    if (!existingSubscription) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Member subscription not found",
      });
    }

    // Prepare update data
    const updateData: any = {};

    if (price !== undefined) {
      updateData.price = parseInt(price);
    }

    if (billing_model !== undefined) {
      if (billing_model !== "MONTHLY" && billing_model !== "YEARLY") {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid billing model. Must be MONTHLY or YEARLY",
        });
      }
      updateData.billing_model = billing_model as BillingModel;
    }

    if (start_date !== undefined) {
      const startDate = new Date(start_date);
      updateData.start_date = startDate;
      
      // Recalculate end date if billing model is set
      if (updateData.billing_model || existingSubscription.billing_model) {
        const billingModel = (updateData.billing_model || existingSubscription.billing_model) as BillingModel;
        updateData.end_date = calculateEndDate(startDate, billingModel);
      }
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    if (is_expired !== undefined) {
      updateData.is_expired = is_expired;
    }

    // Update subscription
    const updated = await prisma.memberSubscription.update({
      where: { id },
      data: updateData,
    });

    return res.status(StatusCodes.OK).json({
      message: "Member subscription updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}


