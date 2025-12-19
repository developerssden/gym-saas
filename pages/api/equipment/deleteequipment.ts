// pages/api/equipment/deleteequipment.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { id } = req.body as { id: string };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: id",
      });
    }

    // Verify equipment belongs to owner
    const existing = await prisma.equipment.findFirst({
      where: {
        id,
        is_deleted: false,
        gym: {
          owner_id: session.user.id,
          is_deleted: false,
        },
      },
    });

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Equipment not found",
      });
    }

    // Soft delete
    await prisma.equipment.update({
      where: { id },
      data: { is_deleted: true },
    });

    return res.status(StatusCodes.OK).json({
      message: "Equipment deleted successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

