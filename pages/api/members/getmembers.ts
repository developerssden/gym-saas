// pages/api/members/getmembers.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";
import { Prisma } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const isGymOwner = session.user.role === "GYM_OWNER";

  try {
    const {
      page,
      limit,
      search,
      gym_id,
      location_id,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      gym_id?: string;
      location_id?: string;
    } = req.body;

    const hasPagination = typeof page === "number" && typeof limit === "number";
    const hasSearch = typeof search === "string" && search.trim() !== "";

    const or: Prisma.MemberWhereInput[] = [];
    if (hasSearch) {
      or.push({
        user: {
          OR: [
            { first_name: { contains: search!, mode: "insensitive" } },
            { last_name: { contains: search!, mode: "insensitive" } },
            { email: { contains: search!, mode: "insensitive" } },
            { phone_number: { contains: search!, mode: "insensitive" } },
          ],
        },
      });
    }

    const whereClause: Prisma.MemberWhereInput = {
      gym_id: gym_id ? gym_id : undefined,
      location_id: location_id ? location_id : undefined,
      // For GYM_OWNER: only show members from their gyms
      ...(isGymOwner
        ? {
            gym: {
              owner_id: session.user.id,
              is_deleted: false,
            },
          }
        : {}),
      OR: or.length ? or : undefined,
    };

    if (!hasPagination && !hasSearch) {
      const members = await prisma.member.findMany({
        where: whereClause,
        include: {
          user: true,
          gym: true,
          location: true,
        },
        orderBy: { joinedAt: "desc" },
      });

      return res.status(StatusCodes.OK).json({
        data: members,
        totalCount: members.length,
        pageCount: 1,
      });
    }

    const currentPage = page ?? 1;
    const pageLimit = limit ?? 10;
    const skip = (currentPage - 1) * pageLimit;

    const [members, totalCount] = await Promise.all([
      prisma.member.findMany({
        where: whereClause,
        include: {
          user: true,
          gym: true,
          location: true,
        },
        orderBy: { joinedAt: "desc" },
        skip,
        take: pageLimit,
      }),
      prisma.member.count({ where: whereClause }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: members,
      totalCount,
      pageCount: Math.ceil(totalCount / pageLimit),
    });
  } catch (err: unknown) {
    console.error("Error in getmembers:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      error: message,
      stack: process.env.NODE_ENV === "development" ? stack : undefined
    });
  }
}

