import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { checkLimitExceeded } from "@/lib/subscription-validation";
import { StaffRole } from "@/prisma/generated/client";

const STAFF_ROLES = new Set(Object.values(StaffRole));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const {
      first_name,
      last_name,
      role,
      specialization,
      phone_number,
      email,
      shift_notes,
      gym_id,
      location_id,
    } = req.body as Record<string, string | undefined>;

    if (!first_name || !gym_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: first_name, gym_id",
      });
    }

    if (role && !STAFF_ROLES.has(role as StaffRole)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid staff role" });
    }

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

    if (location_id) {
      const location = await prisma.location.findFirst({
        where: {
          id: location_id,
          gym_id,
          is_deleted: false,
        },
      });

      if (!location) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Location not found or does not belong to the gym",
        });
      }

      const limitCheck = await checkLimitExceeded(session.user.id, "staff", location_id);
      if (limitCheck.exceeded) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: `Staff limit exceeded. Maximum ${limitCheck.max} staff per location.`,
          limitExceeded: true,
          current: limitCheck.current,
          max: limitCheck.max,
        });
      }
    }

    const staff = await prisma.staff.create({
      data: {
        first_name,
        last_name: last_name || null,
        role: (role as StaffRole) || StaffRole.OTHER,
        specialization: specialization || null,
        phone_number: phone_number || null,
        email: email || null,
        shift_notes: shift_notes || null,
        gym_id,
        location_id: location_id || null,
        is_active: true,
        is_deleted: false,
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Staff created successfully",
      data: staff,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
