// pages/api/expenses/createexpense.ts
import { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { parseCalendarDay } from "@/lib/date-utils";
import { validateExpenseInput, type ExpenseCategoryValue } from "@/lib/expenses";
import { verifyGymAndLocation } from "@/lib/expenses-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res, { permission: "expenses.create" });
  if (!access) return;

  try {
    const { gym_id, location_id, category, amount, expense_date, note } = (req.body ?? {}) as {
      gym_id?: string;
      location_id?: string | null;
      category?: string;
      amount?: number | string;
      /** YYYY-MM-DD; defaults to today. */
      expense_date?: string;
      note?: string;
    };

    const error = validateExpenseInput({ amount, category, note });
    if (error) return res.status(StatusCodes.BAD_REQUEST).json({ error });

    const date = expense_date ? parseCalendarDay(expense_date) : new Date();
    if (!date) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid date" });

    const ownershipError = await verifyGymAndLocation(access, gym_id, location_id);
    if (ownershipError) return res.status(StatusCodes.BAD_REQUEST).json({ error: ownershipError });

    const expense = await prisma.expense.create({
      data: {
        gym_id: gym_id!,
        location_id: location_id || null,
        category: category as ExpenseCategoryValue,
        amount: Number(amount),
        expense_date: date,
        note: typeof note === "string" ? note.trim() || null : null,
        recorded_by_id: access.userId,
      },
    });

    return res.status(StatusCodes.CREATED).json({ message: "Expense added", data: expense });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
