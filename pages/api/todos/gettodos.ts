// pages/api/todos/gettodos.ts
// The gym's to-do list: open ones (soonest due first) or done ones (latest first),
// with a search over the title and notes.
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess } from "@/lib/access";
import type { Prisma } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: "todos.view" });
  if (!access) return;
  // Staff share their owner's to-do list.
  const ownerId = access.ownerId!;

  try {
    const { status, search, limit = 200 } = req.body as {
      /** "open" (default) or "done". */
      status?: "open" | "done";
      search?: string;
      limit?: number;
    };
    const done = status === "done";
    const take = Math.min(Math.max(Number(limit) || 200, 1), 500);

    const base: Prisma.TodoWhereInput = { user_id: ownerId, is_deleted: false };
    const q = typeof search === "string" ? search.trim() : "";
    if (q) {
      base.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    const where: Prisma.TodoWhereInput = { ...base, is_completed: done };

    const [todos, openCount, doneCount] = await Promise.all([
      prisma.todo.findMany({
        where,
        orderBy: done
          ? [{ updatedAt: "desc" }]
          : [{ due_date: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take,
      }),
      prisma.todo.count({ where: { ...base, is_completed: false } }),
      prisma.todo.count({ where: { ...base, is_completed: true } }),
    ]);

    return res.status(StatusCodes.OK).json({ data: todos, openCount, doneCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
