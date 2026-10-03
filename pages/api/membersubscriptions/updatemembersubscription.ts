// pages/api/membersubscriptions/updatemembersubscription.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { calculateEndDate } from "@/lib/subscription-helpers";
import { BillingModel } from "@/prisma/generated/client";
import { isExpiredOrToday } from "@/lib/date-utils";
import { notificationLifecycleReset } from "@/lib/subscription-lifecycle";

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
      end_date,
      is_active,
      is_expired,
    } = req.body;

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Subscription ID is required",
      });
    }

    // Check if subscription exists with member and user info for email
    const existingSubscription = await prisma.memberSubscription.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
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

    // Handle date updates
    let finalEndDate: Date | null = null;

    if (end_date !== undefined) {
      // Direct end_date update
      finalEndDate = new Date(end_date);
      if (isNaN(finalEndDate.getTime())) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid end_date format",
        });
      }
      updateData.end_date = finalEndDate;
    } else if (start_date !== undefined) {
      // Recalculate end date if start_date is updated
      const startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid start_date format",
        });
      }
      updateData.start_date = startDate;
      
      // Recalculate end date if billing model is set
      if (updateData.billing_model || existingSubscription.billing_model) {
        const billingModel = (updateData.billing_model || existingSubscription.billing_model) as BillingModel;
        finalEndDate = calculateEndDate(startDate, billingModel);
        updateData.end_date = finalEndDate;
      }
    }

    // Determine the final end date to use for status calculation
    const endDateToCheck = finalEndDate || updateData.end_date || existingSubscription.end_date;
    const endDateObj = new Date(endDateToCheck);

    // Automatically recalculate is_expired based on end_date
    // Only override if is_expired was not explicitly set
    if (is_expired === undefined) {
      updateData.is_expired = isExpiredOrToday(endDateObj);
    } else {
      updateData.is_expired = is_expired;
    }

    if (updateData.end_date) {
      updateData.is_expired = isExpiredOrToday(endDateObj);
      Object.assign(
        updateData,
        notificationLifecycleReset(
          existingSubscription.end_date,
          updateData.end_date
        )
      );
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    // Update subscription
    const updated = await prisma.memberSubscription.update({
      where: { id },
      data: updateData,
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
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


