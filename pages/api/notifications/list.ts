import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/sessioncheck";
import { notificationsErrorResponse } from "@/lib/notifications/api-error";

function parsePositiveInt(
  value: string | string[] | undefined,
  fallback: number
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" });
  }

  const session = await requireAuthenticatedUser(req, res);
  if (!session) return;

  const userId = session.user.id;
  if (!userId) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Missing authenticated user" });
  }

  const page = parsePositiveInt(req.query.page, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);
  const skip = (page - 1) * limit;

  try {
    const where = { user_id: userId };

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inAppNotification.count({ where }),
      prisma.inAppNotification.count({
        where: { user_id: userId, read: false },
      }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: notifications,
      totalCount,
      unreadCount,
      page,
      limit,
      pageCount: Math.max(1, Math.ceil(totalCount / limit)),
    });
  } catch (err: unknown) {
    const { status, body } = notificationsErrorResponse(
      "[notifications/list]",
      err,
      "Failed to load notifications."
    );
    return res.status(status).json(body);
  }
}
