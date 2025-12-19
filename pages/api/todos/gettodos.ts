// pages/api/todos/gettodos.ts
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
    const {
      page = 1,
      limit = 10,
      is_completed,
    } = req.body as {
      page?: number;
      limit?: number;
      is_completed?: boolean;
    };

    const skip = (page - 1) * limit;

    const where: any = {
      user_id: session.user.id,
      is_deleted: false,
    };

    if (typeof is_completed === "boolean") {
      where.is_completed = is_completed;
    }

    const [todos, totalCount] = await Promise.all([
      prisma.todo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.todo.count({ where }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: todos,
      totalCount,
      pageCount: Math.ceil(totalCount / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

