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

    if (!name || !gym_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: name, gym_id",
      });
    }

    if (category && !CATEGORIES.has(category as ClassCategory)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid category" });
    }
    if (day_of_week && !DAYS.has(day_of_week as DayOfWeek)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid day_of_week" });
    }

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

    const locId = location_id ? String(location_id) : "";
    if (locId) {
      const location = await prisma.location.findFirst({
        where: { id: locId, gym_id: String(gym_id), is_deleted: false },
      });
      if (!location) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Location not found or does not belong to the gym",
        });
      }

      const limitCheck = await checkLimitExceeded(session.user.id, "class", locId);
      if (limitCheck.exceeded) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: `Class limit exceeded. Maximum ${limitCheck.max} classes per location.`,
          limitExceeded: true,
          current: limitCheck.current,
          max: limitCheck.max,
        });
      }
    }

    const instructorId = instructor_id ? String(instructor_id) : "";
    if (instructorId) {
      const instructor = await prisma.staff.findFirst({
        where: {
          id: instructorId,
          is_deleted: false,
          gym_id: String(gym_id),
          gym: { owner_id: session.user.id, is_deleted: false },
        },
      });
      if (!instructor) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Instructor not found or does not belong to this gym",
        });
      }
    }

    const created = await prisma.gymClass.create({
      data: {
        name: String(name),
        category: (category as ClassCategory) || ClassCategory.OTHER,
        description: description ? String(description) : null,
        instructor_id: instructorId || null,
        day_of_week: (day_of_week as DayOfWeek) || null,
        start_time: start_time ? String(start_time) : null,
        end_time: end_time ? String(end_time) : null,
        duration_minutes:
          duration_minutes === "" || duration_minutes == null
            ? null
            : Number(duration_minutes),
        capacity: capacity === "" || capacity == null ? null : Number(capacity),
        gym_id: String(gym_id),
        location_id: locId || null,
        is_active: true,
        is_deleted: false,
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Class created successfully",
      data: created,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
