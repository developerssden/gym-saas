import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAdminOrOwner } from "@/lib/sessioncheck";

type SubscribeBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const userId = session.user.id;
  if (!userId) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Missing authenticated user" });
  }

  if (req.method === "POST") {
    const body = req.body as SubscribeBody;
    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const auth = body.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "endpoint and keys.p256dh / keys.auth are required",
      });
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        user_id: userId,
        endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
      },
      update: {
        user_id: userId,
        p256dh_key: p256dh,
        auth_key: auth,
      },
    });

    return res.status(StatusCodes.OK).json({
      message: "Push subscription saved",
      id: subscription.id,
    });
  }

  if (req.method === "DELETE") {
    const endpoint =
      typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "";

    if (!endpoint) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "endpoint is required" });
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint,
        user_id: userId,
      },
    });

    return res.status(StatusCodes.OK).json({
      message: "Push subscription removed",
    });
  }

  return res
    .status(StatusCodes.METHOD_NOT_ALLOWED)
    .json({ message: "Method not allowed" });
}
