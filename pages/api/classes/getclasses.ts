/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { ClassCategory, DayOfWeek } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const {
      page = 1,
      limit = 50,
      gym_id,
      location_id,
      search,
      category,
      day_of_week,
    } = req.body as {
      page?: number;
      limit?: number;
      gym_id?: string;
      location_id?: string;
      search?: string;
      category?: ClassCategory;
      day_of_week?: DayOfWeek;
    };

    const skip = (page - 1) * limit;

    const where: any = {
      is_deleted: false,
      gym: {
        owner_id: session.user.id,
        is_deleted: false,
      },
    };

    if (gym_id?.trim()) where.gym_id = gym_id;
    if (location_id?.trim()) where.location_id = location_id;
    if (category) where.category = category;
    if (day_of_week) where.day_of_week = day_of_week;
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [classes, totalCount] = await Promise.all([
      prisma.gymClass.findMany({
        where,
        include: {
          gym: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          instructor: {
            select: { id: true, first_name: true, last_name: true, role: true },
          },
        },
        orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.gymClass.count({ where }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: classes,
      totalCount,
      pageCount: Math.ceil(totalCount / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
