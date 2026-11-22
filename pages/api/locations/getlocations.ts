// pages/api/locations/getlocations.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownedGymWhere } from "@/lib/access";
import { ALL_PERMISSIONS } from "@/lib/staff-permissions";
import { Prisma } from "@/prisma/generated/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" });
  }

  // Staff may read their own gym and its locations (forms and filters need them).
  const access = await requireAccess(req, res, { permission: ALL_PERMISSIONS, allowAdmin: true });
  if (!access) return;

  const isGymOwner = !access.isAdmin;

  try {
    const {
      page,
      limit,
      search,
      gym_id,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      gym_id?: string;
    } = req.body;

    const hasPagination = typeof page === "number" && typeof limit === "number";
    const hasSearch = typeof search === "string" && search.trim() !== "";

    const or: Prisma.LocationWhereInput[] = [];
    if (hasSearch) {
      or.push({ name: { contains: search!, mode: "insensitive" } });
      or.push({ city: { contains: search!, mode: "insensitive" } });
      or.push({ gym: { name: { contains: search!, mode: "insensitive" } } });
      or.push({
        gym: {
          owner: {
            OR: [
              { first_name: { contains: search!, mode: "insensitive" } },
              { last_name: { contains: search!, mode: "insensitive" } },
              { email: { contains: search!, mode: "insensitive" } },
            ],
          },
        },
      });
    }

    const whereClause: Prisma.LocationWhereInput = {
      is_deleted: false,
      gym_id: gym_id ? gym_id : undefined,
      // For GYM_OWNER: only show locations for their gyms
      ...(isGymOwner
        ? {
            gym: {
              AND: [ownedGymWhere(access)],
              is_deleted: false,
            },
          }
        : {}),
      OR: or.length ? or : undefined,
    };

    if (!hasPagination && !hasSearch) {
      const locations = await prisma.location.findMany({
        where: whereClause,
        include: { gym: { include: { owner: true } } },
        orderBy: { createdAt: "desc" },
      });

      return res.status(StatusCodes.OK).json({
        data: locations,
        totalCount: locations.length,
        pageCount: 1,
      });
    }

    const currentPage = page ?? 1;
    const pageLimit = limit ?? 10;
    const skip = (currentPage - 1) * pageLimit;

    const [locations, totalCount] = await Promise.all([
      prisma.location.findMany({
        where: whereClause,
        include: { gym: { include: { owner: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageLimit,
      }),
      prisma.location.count({ where: whereClause }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: locations,
      totalCount,
      pageCount: Math.ceil(totalCount / pageLimit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}
