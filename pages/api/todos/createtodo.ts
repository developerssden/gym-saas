// pages/api/todos/createtodo.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess } from "@/lib/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: "todos.create" });
  if (!access) return;
  // Staff share their owner's to-do list.
  const ownerId = access.ownerId!;

  try {
    const { title, description } = req.body as {
      title: string;
      description: string;
    };

    if (!title || !description) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: title, description",
      });
    }

    const todo = await prisma.todo.create({
      data: {
        title,
        description,
        user_id: ownerId,
        is_completed: false,
        is_active: true,
        is_deleted: false,
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Todo created successfully",
      data: todo,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

