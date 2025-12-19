// pages/api/membersubscriptions/updatemembersubscription-owner.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";

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

    const updated = await prisma.memberSubscription.update({
      where: { id },
      data: updateData,
      include: {
        member: {
          include: {
            user: true,
            gym: true,
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
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

