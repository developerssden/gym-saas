import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { id, churn_reason, churn_note } = req.body as {
      id?: string;
      churn_reason?: string;
      churn_note?: string;
    };

    if (!id || !churn_reason) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "id and churn_reason are required",
      });
    }

    const subscription = await prisma.memberSubscription.findFirst({
      where: {
        id,
        is_deleted: false,
        member: {
          gym: {
            owner_id: session.user.id,
          },
        },
      },
    });

    if (!subscription) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Subscription not found",
      });
    }

    const updated = await prisma.memberSubscription.update({
      where: { id },
      data: {
        churn_reason: churn_reason.trim(),
        churn_note: churn_note?.trim() ?? null,
      },
    });

    return res.status(StatusCodes.OK).json({
      message: "Churn reason recorded",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
