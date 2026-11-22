// pages/api/expenses/updateexpense.ts
import { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { parseCalendarDay } from "@/lib/date-utils";
import { validateExpenseInput, type ExpenseCategoryValue } from "@/lib/expenses";
import { findOwnedExpense } from "@/lib/expenses-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { id, category, amount, expense_date, note } = (req.body ?? {}) as {
      id?: string;
      category?: string;
      amount?: number | string;
      expense_date?: string;
      note?: string | null;
    };
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Expense ID is required" });

    const existing = await findOwnedExpense(session.user.id, id);
    if (!existing) return res.status(StatusCodes.NOT_FOUND).json({ error: "Expense not found" });

    const next = {
      amount: amount ?? existing.amount,
      category: category ?? existing.category,
      note: note === undefined ? existing.note : note,
    };
    const error = validateExpenseInput(next);
    if (error) return res.status(StatusCodes.BAD_REQUEST).json({ error });

    let date: Date | undefined;
    if (expense_date !== undefined) {
      const parsed = parseCalendarDay(expense_date);
      if (!parsed) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid date" });
      date = parsed;
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        amount: Number(next.amount),
        category: next.category as ExpenseCategoryValue,
        note: typeof next.note === "string" ? next.note.trim() || null : null,
        ...(date ? { expense_date: date } : {}),
      },
    });

    return res.status(StatusCodes.OK).json({ message: "Expense updated", data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
