// pages/api/locations/getLocation.ts
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
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Location ID is required" });

    const location = await prisma.location.findUnique({
      where: { id },
      include: { gym: { include: { owner: true } } },
    });

    if (!location || location.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Location not found" });
    }

    return res.status(StatusCodes.OK).json(location);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}


