// pages/api/membersubscriptions/deletemembersubscription-owner.ts
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
    const { id } = req.body as { id?: string };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Member subscription ID is required",
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

    // Verify member belongs to owner's gym
    if (existing.member.gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – Member subscription does not belong to your gym",
      });
    }

    // Soft delete: set is_deleted = true and is_active = false
    const deleted = await prisma.memberSubscription.update({
      where: { id },
      data: {
        is_deleted: true,
        is_active: false,
      },
    });

    return res.status(StatusCodes.OK).json({
      message: "Member subscription deleted successfully",
      data: deleted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}



