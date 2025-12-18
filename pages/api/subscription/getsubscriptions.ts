// pages/api/subscription/getSubscriptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { Prisma } from "@/prisma/generated/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" });
  }

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

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

    const or: Prisma.OwnerSubscriptionWhereInput[] = [];

    if (hasSearch) {
      // Search by owner name/email or plan name
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
      or.push({
        plan: { name: { contains: search!, mode: "insensitive" } },
      });
    }

    const whereClause: Prisma.OwnerSubscriptionWhereInput = {
      is_deleted: false,
      owner_id: owner_id ? owner_id : undefined,
      OR: or.length ? or : undefined,
    };

    /* =============================
       Dropdown Mode (No Pagination)
    ============================== */
    if (!hasPagination && !hasSearch) {
      const subscriptions = await prisma.ownerSubscription.findMany({
        where: whereClause,
        include: {
          plan: true,
          owner: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(StatusCodes.OK).json({
        data: subscriptions,
        totalCount: subscriptions.length,
        pageCount: 1,
      });
    }

    /* =============================
       Paginated / Search Mode
    ============================== */
    const currentPage = page ?? 1;
    const pageLimit = limit ?? 10;
    const skip = (currentPage - 1) * pageLimit;

    const [subscriptions, totalCount] = await Promise.all([
      prisma.ownerSubscription.findMany({
        where: whereClause,
        include: {
          plan: true,
          owner: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageLimit,
      }),
      prisma.ownerSubscription.count({ where: whereClause }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: subscriptions,
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
