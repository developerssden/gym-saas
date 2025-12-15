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
    }: {
      page?: number;
      limit?: number;
      search?: string;
    } = req.body;

    const hasPagination = typeof page === "number" && typeof limit === "number";
    const hasSearch = typeof search === "string" && search.trim() !== "";

    const or: Prisma.SubscriptionWhereInput[] = [];

    if (hasSearch) {
      or.push({ name: { contains: search!, mode: "insensitive" } });

      const numericSearch = Number(search);
      if (!isNaN(numericSearch)) {
        or.push({ monthly_price: numericSearch });
        or.push({ yearly_price: numericSearch });
      }
    }

    const whereClause: Prisma.SubscriptionWhereInput = {
      is_deleted: false,
      OR: or.length ? or : undefined,
    };

    /* =============================
       Dropdown Mode (No Pagination)
    ============================== */
    if (!hasPagination && !hasSearch) {
      const subscriptions = await prisma.subscription.findMany({
        where: whereClause,
        orderBy: { createdAt: "asc" },
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
      prisma.subscription.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageLimit,
      }),
      prisma.subscription.count({ where: whereClause }),
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
