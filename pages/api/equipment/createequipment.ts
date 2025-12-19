// pages/api/equipment/createequipment.ts
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
    const { name, type, quantity, weight, gym_id, location_id } = req.body as {
      name: string;
      type: string;
      quantity: string;
      weight?: string;
      gym_id: string;
      location_id?: string;
    };

    if (!name || !type || !quantity || !gym_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: name, type, quantity, gym_id",
      });
    }

    // Verify gym belongs to owner
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

    // If location_id provided, verify it belongs to the gym
    if (location_id) {
      const location = await prisma.location.findFirst({
        where: {
          id: location_id,
          gym_id: gym_id,
          is_deleted: false,
        },
      });

      if (!location) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Location not found or does not belong to the gym",
        });
      }

      // Check equipment limit for this location
      const limitCheck = await checkLimitExceeded(
        session.user.id,
        "equipment",
        location_id
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

    const equipment = await prisma.equipment.create({
      data: {
        name,
        type,
        quantity,
        weight: weight || null,
        gym_id,
        location_id: location_id || null,
        is_active: true,
        is_deleted: false,
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Equipment created successfully",
      data: equipment,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

