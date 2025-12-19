// pages/api/todos/deletetodo.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { id } = req.body as { id: string };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: id",
      });
    }

    // Verify todo belongs to user
    const existing = await prisma.todo.findUnique({
      where: { id },
    });

    if (!existing || existing.is_deleted || existing.user_id !== session.user.id) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Todo not found",
      });
    }

    // Soft delete
    await prisma.todo.update({
      where: { id },
      data: { is_deleted: true },
    });

    return res.status(StatusCodes.OK).json({
      message: "Todo deleted successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

