import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/sessioncheck";
import { notificationsErrorResponse } from "@/lib/notifications/api-error";

type MarkReadBody = {
  ids?: string[];
  all?: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PATCH") {
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

  const body = (req.body ?? {}) as MarkReadBody;
  const markAll = body.all === true;
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (!markAll && ids.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: "Provide { all: true } or a non-empty ids array",
    });
  }

  try {
    const result = await prisma.inAppNotification.updateMany({
      where: markAll
        ? { user_id: userId, read: false }
        : { user_id: userId, id: { in: ids } },
      data: { read: true },
    });

    return res.status(StatusCodes.OK).json({
      message: "Notifications marked as read",
      updated: result.count,
    });
  } catch (err: unknown) {
    const { status, body: errorBody } = notificationsErrorResponse(
      "[notifications/mark-read]",
      err,
      "Failed to mark notifications as read."
    );
    return res.status(status).json(errorBody);
  }
}
