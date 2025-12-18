// pages/api/gyms/activeGym.ts
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
    const { id } = req.body as { id?: string };
    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Gym ID is required" });
    }

    const gym = await prisma.gym.findUnique({
      where: { id },
      select: { is_active: true, is_deleted: true },
    });

    if (!gym || gym.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Gym not found" });
    }

    const updated = await prisma.gym.update({
      where: { id },
      data: { is_active: !gym.is_active },
    });

    return res.status(StatusCodes.OK).json({
      message: updated.is_active ? "Gym activated" : "Gym deactivated",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}


