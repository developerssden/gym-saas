// pages/api/equipment/getequipments.ts
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
      page = 1,
      limit = 10,
      gym_id,
      location_id,
      search,
    } = req.body as {
      page?: number;
      limit?: number;
      gym_id?: string;
      location_id?: string;
      search?: string;
    };

    const skip = (page - 1) * limit;

    const where: any = {
      is_deleted: false,
      gym: {
        owner_id: session.user.id,
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

    const [equipments, totalCount] = await Promise.all([
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
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
      prisma.equipment.count({ where }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: equipments,
      totalCount,
      pageCount: Math.ceil(totalCount / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

