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
      id,
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

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: id",
      });
    }

    if (role && !STAFF_ROLES.has(role as StaffRole)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid staff role" });
    }

    const existing = await prisma.staff.findFirst({
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
        error: "Staff not found",
      });
    }

    const finalLocationId = location_id !== undefined ? location_id : existing.location_id;
    if (finalLocationId && location_id !== existing.location_id) {
      const limitCheck = await checkLimitExceeded(
        session.user.id,
        "staff",
        finalLocationId
      );

      if (limitCheck.exceeded) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: `Staff limit exceeded. Maximum ${limitCheck.max} staff per location.`,
          limitExceeded: true,
          current: limitCheck.current,
          max: limitCheck.max,
        });
      }
    }

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

    const updateData: Record<string, unknown> = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name || null;
    if (role !== undefined) updateData.role = role;
    if (specialization !== undefined) updateData.specialization = specialization || null;
    if (phone_number !== undefined) updateData.phone_number = phone_number || null;
    if (email !== undefined) updateData.email = email || null;
    if (shift_notes !== undefined) updateData.shift_notes = shift_notes || null;
    if (gym_id !== undefined) updateData.gym_id = gym_id;
    if (location_id !== undefined) updateData.location_id = location_id || null;

    const updated = await prisma.staff.update({
      where: { id },
      data: updateData,
    });

    return res.status(StatusCodes.OK).json({
      message: "Staff updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
