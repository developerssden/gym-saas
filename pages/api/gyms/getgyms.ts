// pages/api/gyms/getGyms.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownedGymWhere } from "@/lib/access";
import { ALL_PERMISSIONS } from "@/lib/staff-permissions";
import { Prisma } from "@/prisma/generated/client";

const gymInclude = {
  owner: true,
  _count: {
    select: {
      locations: { where: { is_deleted: false } },
      members: true,
    },
  },
} satisfies Prisma.GymInclude;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
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
      owner_id,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      owner_id?: string;
    } = req.body;

    const hasPagination = typeof page === "number" && typeof limit === "number";
    const hasSearch = typeof search === "string" && search.trim() !== "";

    const or: Prisma.GymWhereInput[] = [];
    if (hasSearch) {
      or.push({ name: { contains: search!, mode: "insensitive" } });
      or.push({ city: { contains: search!, mode: "insensitive" } });
      or.push({
        owner: {
          OR: [
            { first_name: { contains: search!, mode: "insensitive" } },
            { last_name: { contains: search!, mode: "insensitive" } },
            { email: { contains: search!, mode: "insensitive" } },
            { phone_number: { contains: search!, mode: "insensitive" } },
          ],
        },
      });
    }

    const whereClause: Prisma.GymWhereInput = {
      is_deleted: false,
      // For GYM_OWNER: only show their own gyms
      // For SUPER_ADMIN: show all gyms or filter by owner_id if provided
      owner_id: isGymOwner ? undefined : owner_id ? owner_id : undefined,
      AND: isGymOwner ? [ownedGymWhere(access)] : undefined,
      OR: or.length ? or : undefined,
    };

    if (!hasPagination && !hasSearch) {
      const gyms = await prisma.gym.findMany({
        where: whereClause,
        include: gymInclude,
        orderBy: { createdAt: "desc" },
      });

      return res.status(StatusCodes.OK).json({
        data: gyms,
        totalCount: gyms.length,
        pageCount: 1,
      });
    }

    const currentPage = page ?? 1;
    const pageLimit = limit ?? 10;
    const skip = (currentPage - 1) * pageLimit;

    const [gyms, totalCount] = await Promise.all([
      prisma.gym.findMany({
        where: whereClause,
        include: gymInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageLimit,
      }),
      prisma.gym.count({ where: whereClause }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: gyms,
      totalCount,
      pageCount: Math.ceil(totalCount / pageLimit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}


