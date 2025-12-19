// pages/api/gyms/getGym.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const isGymOwner = session.user.role === "GYM_OWNER";

  try {
    const { id } = req.body as { id?: string };
    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Gym ID is required" });
    }

    const gym = await prisma.gym.findUnique({
      where: { id },
      include: {
        owner: true,
        locations: {
          where: { is_deleted: false },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!gym || gym.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Gym not found" });
    }

    // For GYM_OWNER: verify they own this gym
    if (isGymOwner && gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – You can only access your own gyms",
      });
    }

    return res.status(StatusCodes.OK).json(gym);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}


