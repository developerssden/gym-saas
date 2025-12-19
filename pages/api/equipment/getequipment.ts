// pages/api/equipment/getequipment.ts
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

    const equipment = await prisma.equipment.findFirst({
      where: {
        id,
        is_deleted: false,
        gym: {
          owner_id: session.user.id,
          is_deleted: false,
        },
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!equipment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Equipment not found",
      });
    }

    return res.status(StatusCodes.OK).json(equipment);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

