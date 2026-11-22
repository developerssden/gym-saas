// pages/api/members/getmembers.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, gymScope } from "@/lib/access";
import { Prisma } from "@/prisma/generated/client";
import { memberListSelect } from "@/lib/api-selects";
import { memberIdsMatchingPhone, phoneSearchDigits } from "@/lib/members/phone-search";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  // Member lists also feed the member pickers on subscriptions and payments.
  const access = await requireAccess(req, res, {
    permission: ["members.view", "membersubscriptions.view", "membersubscriptions.create", "payments.record"],
    allowAdmin: true,
  });
  if (!access) return;

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
      // Phone numbers in any format: "0301 84" finds "+92301 84…".
      const digits = phoneSearchDigits(search);
      if (digits) {
        const ids = await memberIdsMatchingPhone(digits, access.ownerId);
        if (ids.length) or.push({ id: { in: ids } });
      }
    }

    const whereClause: Prisma.MemberWhereInput = {
      gym_id: gym_id ? gym_id : undefined,
      location_id: location_id ? location_id : undefined,
      // Owners and staff: only members from their gyms
      ...gymScope(access),
      OR: or.length ? or : undefined,
    };

    if (!hasPagination && !hasSearch) {
      const members = await prisma.member.findMany({
        where: whereClause,
        select: memberListSelect,
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
        select: memberListSelect,
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

