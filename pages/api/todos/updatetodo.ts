// pages/api/todos/updatetodo.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess } from "@/lib/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: "todos.edit" });
  if (!access) return;
  // Staff share their owner's to-do list.
  const ownerId = access.ownerId!;

  try {
    const { id, title, description, is_completed } = req.body as {
      id: string;
      title?: string;
      description?: string;
      is_completed?: boolean;
    };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: id",
      });
    }

    // Verify todo belongs to user
    const existing = await prisma.todo.findUnique({
      where: { id },
    });

    if (!existing || existing.is_deleted || existing.user_id !== ownerId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Todo not found",
      });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (is_completed !== undefined) updateData.is_completed = is_completed;

    const updated = await prisma.todo.update({
      where: { id },
      data: updateData,
    });

    return res.status(StatusCodes.OK).json({
      message: "Todo updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

