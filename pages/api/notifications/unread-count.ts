import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/sessioncheck";
import { notificationsErrorResponse } from "@/lib/notifications/api-error";

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

  try {
    const unreadCount = await prisma.inAppNotification.count({
      where: { user_id: userId, read: false },
    });

    return res.status(StatusCodes.OK).json({ unreadCount });
  } catch (err: unknown) {
    const { status, body } = notificationsErrorResponse(
      "[notifications/unread-count]",
      err,
      "Failed to load unread notification count."
    );
    return res.status(status).json(body);
  }
}
