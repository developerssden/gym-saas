// pages/api/clients/getclient.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Client ID is required",
      });
    }

    const client = await prisma.user.findUnique({
      where: {
        id,
        is_deleted: false,
        role: "GYM_OWNER",
      },
      include: {
        ownerSubscriptions: {
          where: {
            is_deleted: false,
          },
          include: {
            plan: true,
            payments: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!client) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Client not found",
      });
    }

    // Get active subscription info
    const activeSubscription = client.ownerSubscriptions.find(
      (sub) => sub.is_active && !sub.is_expired
    );

    return res.status(StatusCodes.OK).json({
      ...client,
      activeSubscription,
      subscriptionType: activeSubscription?.billing_model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}


