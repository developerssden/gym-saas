// pages/api/membersubscriptions/updatemembersubscription-owner.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { isSubscriptionExpired, getRemainingDays } from "@/lib/subscription-helpers";
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

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const {
      id,
      price,
      months,
      start_date,
      end_date,
      use_custom_dates,
    } = req.body as {
      id: string;
      price?: number;
      months?: number;
      start_date?: string;
      end_date?: string;
      use_custom_dates?: boolean;
    };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: id",
      });
    }

    // Get existing subscription
    const existing = await prisma.memberSubscription.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            gym: true,
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

    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Member subscription not found",
      });
    }

    // Verify member belongs to owner
    if (existing.member.gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – Member subscription does not belong to your gym",
      });
    }

    // Prepare update data
    const updateData: any = {};

    if (price !== undefined) {
      updateData.price = parseInt(String(price));
    }

    // Handle date updates
    if (use_custom_dates !== undefined) {
      if (use_custom_dates) {
        // Custom dates: require start_date and end_date
        if (!start_date || !end_date) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "Missing required fields: start_date and end_date (when use_custom_dates is true)",
          });
        }

        const finalStartDate = new Date(start_date);
        const finalEndDate = new Date(end_date);

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

        updateData.start_date = finalStartDate;
        updateData.end_date = finalEndDate;
      } else {
        // Months-based: require months
        if (!months || months <= 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "Missing or invalid field: months (when use_custom_dates is false)",
          });
        }

        const finalStartDate = new Date(); // Current date
        const finalEndDate = new Date(finalStartDate);
        finalEndDate.setMonth(finalEndDate.getMonth() + months);

        updateData.start_date = finalStartDate;
        updateData.end_date = finalEndDate;
      }
    } else {
      // If use_custom_dates not provided, allow individual date updates
      if (start_date !== undefined) {
        updateData.start_date = new Date(start_date);
      }
      if (end_date !== undefined) {
        updateData.end_date = new Date(end_date);
      }
    }

    // Determine the final end date to use for status calculation
    const endDateToCheck = updateData.end_date || existing.end_date;
    const endDateObj = new Date(endDateToCheck);

    // Automatically recalculate is_expired based on end_date
    updateData.is_expired = isSubscriptionExpired(endDateObj);

    // If subscription is extended (no longer expired), reset reminder flags
    if (existing.is_expired && !updateData.is_expired) {
      updateData.first_reminder_sent = false;
      updateData.second_reminder_sent = false;
      updateData.notification_sent = false;
    }

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
            gym: true,
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
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

