// pages/api/membersubscriptions/updatemembersubscription-owner.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import sendEmail from "@/lib/sendEmail";
import { getDaysUntilExpiration, isExpiredOrToday } from "@/lib/date-utils";
import { REMINDER_DAYS } from "@/lib/constants";
import { getMemberReminderEmail } from "@/lib/email/subscription-emails";
import { notificationLifecycleReset } from "@/lib/subscription-lifecycle";

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
    updateData.is_expired = isExpiredOrToday(endDateObj);

    if (updateData.end_date) {
      Object.assign(
        updateData,
        notificationLifecycleReset(existing.end_date, updateData.end_date)
      );
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
      if (daysLeft === REMINDER_DAYS.FIRST && !updated.first_reminder_sent) {
        const memberName = `${updated.member.user.first_name} ${updated.member.user.last_name}`;
        const { subject, text, html } = getMemberReminderEmail(memberName, REMINDER_DAYS.FIRST);
        
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
      } else if (daysLeft === REMINDER_DAYS.SECOND && !updated.second_reminder_sent) {
        const memberName = `${updated.member.user.first_name} ${updated.member.user.last_name}`;
        const { subject, text, html } = getMemberReminderEmail(memberName, REMINDER_DAYS.SECOND);
        
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

