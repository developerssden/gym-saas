import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/client";
import { requireAdminOrOwner } from "@/lib/sessioncheck";

type SubscribeBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function pushSubscribeErrorResponse(err: unknown, fallbackMessage: string) {
  const code =
    err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined;
  const isSchemaMismatch = code === "P2021" || code === "P2022";

  console.error("[push/subscribe] failed", {
    code,
    meta: err instanceof Prisma.PrismaClientKnownRequestError ? err.meta : undefined,
    message: err instanceof Error ? err.message : err,
  });

  return {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    body: {
      error: isSchemaMismatch
        ? "Push notifications are unavailable (database schema mismatch)."
        : fallbackMessage,
      ...(code ? { code } : {}),
    },
  };
}

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

    try {
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
    } catch (err: unknown) {
      const { status, body } = pushSubscribeErrorResponse(
        err,
        "Failed to save push subscription."
      );
      return res.status(status).json(body);
    }
  }

  if (req.method === "DELETE") {
    const endpoint =
      typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "";

    if (!endpoint) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "endpoint is required" });
    }

    try {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint,
          user_id: userId,
        },
      });

      return res.status(StatusCodes.OK).json({
        message: "Push subscription removed",
      });
    } catch (err: unknown) {
      const { status, body } = pushSubscribeErrorResponse(
        err,
        "Failed to save push subscription."
      );
      return res.status(status).json(body);
    }
  }

  return res
    .status(StatusCodes.METHOD_NOT_ALLOWED)
    .json({ message: "Method not allowed" });
}
