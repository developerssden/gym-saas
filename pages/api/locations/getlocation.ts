// pages/api/locations/getLocation.ts
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
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Location ID is required" });

    const location = await prisma.location.findUnique({
      where: { id },
      include: { gym: { include: { owner: true } } },
    });

    if (!location || location.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Location not found" });
    }

    // For GYM_OWNER: verify they own the gym this location belongs to
    if (isGymOwner && location.gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – You can only access locations for your gyms",
      });
    }

    return res.status(StatusCodes.OK).json(location);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}


