// pages/api/todos/createtodo.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess } from "@/lib/access";
import { parseDueDay, validateTodoInput } from "@/lib/todos";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: "todos.create" });
  if (!access) return;
  // Staff share their owner's to-do list.
  const ownerId = access.ownerId!;

  try {
    const { title, description, due_date } = req.body as {
      title?: string;
      description?: string | null;
      /** "yyyy-MM-dd", optional. */
      due_date?: string | null;
    };

    const error = validateTodoInput({ title: title ?? "", description, due_date });
    if (error) return res.status(StatusCodes.BAD_REQUEST).json({ error });
    const due = parseDueDay(due_date);

    const todo = await prisma.todo.create({
      data: {
        title: (title as string).trim(),
        description: description?.trim() ?? "",
        due_date: due instanceof Date ? due : null,
        user_id: ownerId,
        is_completed: false,
        is_active: true,
        is_deleted: false,
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "To-do added",
      data: todo,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

