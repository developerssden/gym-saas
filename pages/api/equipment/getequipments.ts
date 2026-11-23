// pages/api/equipment/getequipments.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownedGymWhere } from "@/lib/access";
import { addDays, startOfDay } from "date-fns";
import { MAINTENANCE_SOON_DAYS } from "@/lib/equipment";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: "equipment.view" });
  if (!access) return;

  try {
    const {
      page = 1,
      limit = 10,
      gym_id,
      location_id,
      search,
      today,
    } = req.body as {
      page?: number;
      limit?: number;
      gym_id?: string;
      location_id?: string;
      search?: string;
      /** Start of today on the device (ISO), for what counts as overdue. */
      today?: string;
    };

    const skip = (page - 1) * limit;

    const where: any = {
      is_deleted: false,
      gym: {
        AND: [ownedGymWhere(access)],
        is_deleted: false,
      },
    };

    if (gym_id && gym_id.trim() !== "") {
      where.gym_id = gym_id;
    }

    if (location_id && location_id.trim() !== "") {
      where.location_id = location_id;
    }

    // Handle search with proper OR clause
    if (search && search.trim() !== "") {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { type: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const parsedToday = today ? new Date(today) : null;
    const startOfToday = parsedToday && !Number.isNaN(parsedToday.getTime()) ? parsedToday : startOfDay(new Date());
    const { OR: _search, ...scope } = where;
    void _search;
    const dueWhere = { ...scope, status: { not: "RETIRED" as const } };

    const [equipments, totalCount, overdueCount, dueSoonCount] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: {
          gym: {
            select: {
              id: true,
              name: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        // Soonest maintenance first, so overdue items are at the top.
        orderBy: [{ next_maintenance_due: { sort: "asc", nulls: "last" } }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.equipment.count({ where }),
      // For the summary: in this branch, whatever the search.
      prisma.equipment.count({ where: { ...dueWhere, next_maintenance_due: { lt: startOfToday } } }),
      prisma.equipment.count({
        where: { ...dueWhere, next_maintenance_due: { gte: startOfToday, lt: addDays(startOfToday, MAINTENANCE_SOON_DAYS + 1) } },
      }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: equipments,
      totalCount,
      pageCount: Math.ceil(totalCount / limit),
      overdueCount,
      dueSoonCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

