// pages/api/expenses/getexpenses.ts
import { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { Prisma } from "@/prisma/generated/client";
import { EXPENSE_CATEGORIES, isExpenseCategory } from "@/lib/expenses";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { page, limit, gym_id, location_id, search, category } = (req.body ?? {}) as {
      page?: number;
      limit?: number;
      gym_id?: string;
      location_id?: string;
      search?: string;
      category?: string;
    };

    const currentPage = typeof page === "number" && page > 0 ? page : 1;
    const pageLimit = typeof limit === "number" && limit > 0 ? Math.min(limit, 100) : 10;

    const term = typeof search === "string" ? search.trim() : "";
    const or: Prisma.ExpenseWhereInput[] = [];
    if (term) {
      or.push({ note: { contains: term, mode: "insensitive" } });
      const lower = term.toLowerCase();
      const matchingCategories = EXPENSE_CATEGORIES.filter((c) =>
        c.label.toLowerCase().includes(lower)
      ).map((c) => c.value);
      if (matchingCategories.length) or.push({ category: { in: matchingCategories } });
    }

    const where: Prisma.ExpenseWhereInput = {
      is_deleted: false,
      gym: { owner_id: session.user.id, is_deleted: false },
      ...(gym_id ? { gym_id } : {}),
      ...(location_id ? { location_id } : {}),
      ...(isExpenseCategory(category) ? { category } : {}),
      ...(or.length ? { OR: or } : {}),
    };

    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { location: { select: { id: true, name: true } } },
        orderBy: [{ expense_date: "desc" }, { createdAt: "desc" }],
        skip: (currentPage - 1) * pageLimit,
        take: pageLimit,
      }),
      prisma.expense.count({ where }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: expenses,
      totalCount,
      pageCount: Math.ceil(totalCount / pageLimit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
