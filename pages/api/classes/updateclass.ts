import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { checkLimitExceeded } from "@/lib/subscription-validation";
import { ClassCategory, DayOfWeek } from "@/prisma/generated/client";

const CATEGORIES = new Set(Object.values(ClassCategory));
const DAYS = new Set(Object.values(DayOfWeek));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const {
      id,
      name,
      category,
      description,
      instructor_id,
      day_of_week,
      start_time,
      end_time,
      duration_minutes,
      capacity,
      gym_id,
      location_id,
    } = req.body as Record<string, unknown>;

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Missing required field: id" });
    }

    if (category && !CATEGORIES.has(category as ClassCategory)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid category" });
    }
    if (day_of_week && !DAYS.has(day_of_week as DayOfWeek)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid day_of_week" });
    }

    const existing = await prisma.gymClass.findFirst({
      where: {
        id: String(id),
        is_deleted: false,
        gym: { owner_id: session.user.id, is_deleted: false },
      },
    });

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Class not found" });
    }

    const finalLocationId =
      location_id !== undefined ? (location_id ? String(location_id) : null) : existing.location_id;

    if (finalLocationId && location_id !== existing.location_id) {
      const limitCheck = await checkLimitExceeded(
        session.user.id,
        "class",
        finalLocationId
      );
      if (limitCheck.exceeded) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: `Class limit exceeded. Maximum ${limitCheck.max} classes per location.`,
          limitExceeded: true,
          current: limitCheck.current,
          max: limitCheck.max,
        });
      }
    }

    if (gym_id && gym_id !== existing.gym_id) {
      const gym = await prisma.gym.findFirst({
        where: {
          id: String(gym_id),
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

    const finalGymId = gym_id ? String(gym_id) : existing.gym_id;
    if (finalLocationId) {
      const location = await prisma.location.findFirst({
        where: { id: finalLocationId, gym_id: finalGymId, is_deleted: false },
      });
      if (!location) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Location not found or does not belong to the gym",
        });
      }
    }

    const instructorId =
      instructor_id !== undefined
        ? instructor_id
          ? String(instructor_id)
          : null
        : existing.instructor_id;

    if (instructorId) {
      const instructor = await prisma.staff.findFirst({
        where: {
          id: instructorId,
          is_deleted: false,
          gym_id: finalGymId,
          gym: { owner_id: session.user.id, is_deleted: false },
        },
      });
      if (!instructor) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Instructor not found or does not belong to this gym",
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description || null;
    if (instructor_id !== undefined) updateData.instructor_id = instructorId;
    if (day_of_week !== undefined) updateData.day_of_week = day_of_week || null;
    if (start_time !== undefined) updateData.start_time = start_time || null;
    if (end_time !== undefined) updateData.end_time = end_time || null;
    if (duration_minutes !== undefined)
      updateData.duration_minutes =
        duration_minutes === "" || duration_minutes == null ? null : Number(duration_minutes);
    if (capacity !== undefined)
      updateData.capacity = capacity === "" || capacity == null ? null : Number(capacity);
    if (gym_id !== undefined) updateData.gym_id = gym_id;
    if (location_id !== undefined) updateData.location_id = finalLocationId;

    const updated = await prisma.gymClass.update({
      where: { id: String(id) },
      data: updateData,
    });

    return res.status(StatusCodes.OK).json({
      message: "Class updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
