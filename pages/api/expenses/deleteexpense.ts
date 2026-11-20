// pages/api/expenses/deleteexpense.ts
import { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { findOwnedExpense } from "@/lib/expenses-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { id } = (req.body ?? {}) as { id?: string };
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Expense ID is required" });

    const existing = await findOwnedExpense(session.user.id, id);
    if (!existing) return res.status(StatusCodes.NOT_FOUND).json({ error: "Expense not found" });

    await prisma.expense.update({ where: { id }, data: { is_deleted: true } });
    return res.status(StatusCodes.OK).json({ message: "Expense deleted" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
