import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { attendanceDateOnly } from "@/lib/attendance-date";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { class_id, attendance_date } = req.body as {
      class_id: string;
      attendance_date: string;
    };

    if (!class_id || !attendance_date) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: class_id, attendance_date",
      });
    }

    const dateOnly = attendanceDateOnly(attendance_date);

    const gymClass = await prisma.gymClass.findFirst({
      where: {
        id: class_id,
        is_deleted: false,
        gym: { owner_id: session.user.id, is_deleted: false },
      },
    });

    if (!gymClass) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Class not found" });
    }

    const rows = await prisma.classAttendance.findMany({
      where: {
        class_id,
        attendance_date: dateOnly,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
              },
            },
          },
        },
        recordedBy: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return res.status(StatusCodes.OK).json({ data: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
