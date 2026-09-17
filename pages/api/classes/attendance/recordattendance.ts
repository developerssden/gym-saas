import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { attendanceDateOnly } from "@/lib/attendance-date";
import { AttendanceStatus } from "@/prisma/generated/client";

const STATUSES = new Set(Object.values(AttendanceStatus));

type RecordInput = {
  member_id: string;
  status?: AttendanceStatus;
  notes?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const {
      class_id,
      member_id,
      attendance_date,
      status,
      notes,
      recorded_by_id,
      records,
    } = req.body as {
      class_id: string;
      member_id?: string;
      attendance_date: string;
      status?: AttendanceStatus;
      notes?: string;
      recorded_by_id?: string;
      records?: RecordInput[];
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

    if (recorded_by_id) {
      const recorder = await prisma.staff.findFirst({
        where: {
          id: recorded_by_id,
          is_deleted: false,
          gym_id: gymClass.gym_id,
          gym: { owner_id: session.user.id, is_deleted: false },
        },
      });
      if (!recorder) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "recorded_by staff not found",
        });
      }
    }

    const entries: RecordInput[] =
      Array.isArray(records) && records.length
        ? records
        : member_id
          ? [{ member_id, status, notes }]
          : [];

    if (entries.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Provide member_id or a non-empty records array",
      });
    }

    for (const entry of entries) {
      if (entry.status && !STATUSES.has(entry.status)) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid attendance status" });
      }
    }

    const memberIds = entries.map((e) => e.member_id);
    const members = await prisma.member.findMany({
      where: {
        id: { in: memberIds },
        gym: { owner_id: session.user.id, is_deleted: false, id: gymClass.gym_id },
      },
      select: { id: true },
    });
    if (members.length !== new Set(memberIds).size) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "One or more members do not belong to this gym",
      });
    }

    const saved = await prisma.$transaction(
      entries.map((entry) =>
        prisma.classAttendance.upsert({
          where: {
            class_id_member_id_attendance_date: {
              class_id,
              member_id: entry.member_id,
              attendance_date: dateOnly,
            },
          },
          create: {
            class_id,
            member_id: entry.member_id,
            attendance_date: dateOnly,
            status: entry.status || AttendanceStatus.PRESENT,
            notes: entry.notes || null,
            recorded_by_id: recorded_by_id || null,
          },
          update: {
            status: entry.status || AttendanceStatus.PRESENT,
            notes: entry.notes ?? undefined,
            recorded_by_id: recorded_by_id || null,
          },
        })
      )
    );

    return res.status(StatusCodes.OK).json({
      message: "Attendance recorded",
      data: saved,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
