// pages/api/membersubscriptions/updatemembersubscription.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { calculateEndDate, isSubscriptionExpired, getRemainingDays } from "@/lib/subscription-helpers";
import { BillingModel } from "@/prisma/generated/client";
import sendEmail from "@/lib/sendEmail";

// Calculate days until expiration
const getDaysUntilExpiration = (endDate: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Email template for member reminders
const getMemberReminderEmail = (memberName: string, daysLeft: number) => {
  const subject = daysLeft === 0
    ? "Your Gym Membership Has Expired"
    : `Your Gym Membership Expires in ${daysLeft} Day${daysLeft > 1 ? "s" : ""}`;
  
  const text = daysLeft === 0
    ? `Dear ${memberName},\n\nYour gym membership has expired. Please renew your membership to continue accessing the gym.\n\nThank you.`
    : `Dear ${memberName},\n\nThis is a reminder that your gym membership will expire in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.\n\nPlease renew your membership to avoid any interruption in service.\n\nThank you.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p>Dear ${memberName},</p>
      ${daysLeft === 0
        ? `<p>Your gym membership has expired. Please renew your membership to continue accessing the gym.</p>`
        : `<p>This is a reminder that your gym membership will expire in <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong>.</p>
           <p>Please renew your membership to avoid any interruption in service.</p>`
      }
      <p>Thank you.</p>
    </div>
  `;
  
  return { subject, text, html };
};

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
      updateData.is_expired = isSubscriptionExpired(endDateObj);
    } else {
      updateData.is_expired = is_expired;
    }

    // If subscription is extended (no longer expired), reset reminder flags
    if (existingSubscription.is_expired && !updateData.is_expired) {
      updateData.first_reminder_sent = false;
      updateData.second_reminder_sent = false;
      updateData.notification_sent = false;
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

    // Send warning email if subscription is close to expiring (within 2 days)
    // Only send if subscription is active and not expired
    if (!updated.is_expired && updated.is_active && updated.member.user.email) {
      const daysLeft = getDaysUntilExpiration(updated.end_date);
      
      // Send email if:
      // - 2 days left and first reminder not sent
      // - 1 day left and second reminder not sent
      // - 0 days left (expired today)
      if (daysLeft === 2 && !updated.first_reminder_sent) {
        const memberName = `${updated.member.user.first_name} ${updated.member.user.last_name}`;
        const { subject, text, html } = getMemberReminderEmail(memberName, 2);
        
        try {
          await sendEmail(updated.member.user.email, subject, text, html);
          
          // Update reminder flag
          await prisma.memberSubscription.update({
            where: { id },
            data: { first_reminder_sent: true },
          });
        } catch (error) {
          console.error(`Failed to send reminder email to ${updated.member.user.email}:`, error);
        }
      } else if (daysLeft === 1 && !updated.second_reminder_sent) {
        const memberName = `${updated.member.user.first_name} ${updated.member.user.last_name}`;
        const { subject, text, html } = getMemberReminderEmail(memberName, 1);
        
        try {
          await sendEmail(updated.member.user.email, subject, text, html);
          
          // Update reminder flag
          await prisma.memberSubscription.update({
            where: { id },
            data: { second_reminder_sent: true },
          });
        } catch (error) {
          console.error(`Failed to send reminder email to ${updated.member.user.email}:`, error);
        }
      } else if (daysLeft === 0) {
        const memberName = `${updated.member.user.first_name} ${updated.member.user.last_name}`;
        const { subject, text, html } = getMemberReminderEmail(memberName, 0);
        
        try {
          await sendEmail(updated.member.user.email, subject, text, html);
          
          // Mark as expired and notification sent
          await prisma.memberSubscription.update({
            where: { id },
            data: {
              is_expired: true,
              notification_sent: true,
            },
          });
        } catch (error) {
          console.error(`Failed to send expiration email to ${updated.member.user.email}:`, error);
        }
      }
    }

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


