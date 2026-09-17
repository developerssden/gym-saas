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
    const { member_id } = req.body as { member_id: string };
    if (!member_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: member_id",
      });
    }

    const member = await prisma.member.findFirst({
      where: {
        id: member_id,
        gym: { owner_id: session.user.id, is_deleted: false },
      },
    });

    if (!member) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Member not found" });
    }

    const rows = await prisma.classAttendance.findMany({
      where: { member_id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            category: true,
            day_of_week: true,
            start_time: true,
          },
        },
      },
      orderBy: { attendance_date: "desc" },
    });

    return res.status(StatusCodes.OK).json({ data: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
