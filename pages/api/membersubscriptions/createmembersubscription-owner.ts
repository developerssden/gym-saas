// pages/api/membersubscriptions/createmembersubscription-owner.ts
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
      member_id,
      price,
      months,
      start_date,
      end_date,
      use_custom_dates,
    } = req.body as {
      member_id: string;
      price: number;
      months?: number;
      start_date?: string;
      end_date?: string;
      use_custom_dates: boolean;
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

    // Create MemberSubscription (payment is created separately)
    const memberSubscription = await prisma.memberSubscription.create({
      data: {
        member_id,
        price: parseInt(String(price)),
        billing_model: "MONTHLY", // Default, can be adjusted if needed
        start_date: finalStartDate,
        end_date: finalEndDate,
        is_expired: false,
        is_active: true,
      },
      include: {
        member: {
          include: {
            user: true,
            gym: true,
          },
        },
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Member subscription created successfully",
      data: memberSubscription,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

