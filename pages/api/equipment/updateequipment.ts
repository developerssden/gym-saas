// pages/api/equipment/updateequipment.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { checkLimitExceeded } from "@/lib/subscription-validation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { id, name, type, quantity, weight, gym_id, location_id } = req.body as {
      id: string;
      name?: string;
      type?: string;
      quantity?: string;
      weight?: string;
      gym_id?: string;
      location_id?: string;
    };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: id",
      });
    }

    // Verify equipment belongs to owner
    const existing = await prisma.equipment.findFirst({
      where: {
        id,
        is_deleted: false,
        gym: {
          owner_id: session.user.id,
          is_deleted: false,
        },
      },
    });

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Equipment not found",
      });
    }

    // If location_id is being changed, check limit
    const finalLocationId = location_id !== undefined ? location_id : existing.location_id;
    if (finalLocationId && location_id !== existing.location_id) {
      const limitCheck = await checkLimitExceeded(
        session.user.id,
        "equipment",
        finalLocationId
      );

      if (limitCheck.exceeded) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: `Equipment limit exceeded. Maximum ${limitCheck.max} equipment per location.`,
          limitExceeded: true,
          current: limitCheck.current,
          max: limitCheck.max,
        });
      }
    }

    // If gym_id is being changed, verify it belongs to owner
    if (gym_id && gym_id !== existing.gym_id) {
      const gym = await prisma.gym.findFirst({
        where: {
          id: gym_id,
          owner_id: session.user.id,
          is_deleted: false,
        },
      });

      if (!gym) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Gym not found or does not belong to you",
        });
      }
    }

    // If location_id is provided, verify it belongs to the gym
    const finalGymId = gym_id || existing.gym_id;
    if (finalLocationId) {
      const location = await prisma.location.findFirst({
        where: {
          id: finalLocationId,
          gym_id: finalGymId,
          is_deleted: false,
        },
      });

      if (!location) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Location not found or does not belong to the gym",
        });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (weight !== undefined) updateData.weight = weight;
    if (gym_id !== undefined) updateData.gym_id = gym_id;
    if (location_id !== undefined) updateData.location_id = location_id || null;

    const updated = await prisma.equipment.update({
      where: { id },
      data: updateData,
    });

    return res.status(StatusCodes.OK).json({
      message: "Equipment updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

