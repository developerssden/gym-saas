// pages/api/members/deletemember.ts
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
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Member ID is required" });
    }

    const existing = await prisma.member.findUnique({
      where: { id },
      include: {
        gym: true,
        user: true,
      },
    });

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Member not found" });
    }

    // For GYM_OWNER: verify they own the gym this member belongs to
    if (isGymOwner && existing.gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – You can only delete members from your gyms",
      });
    }

    // Soft delete: delete Member record and set is_deleted = true on User
    await prisma.$transaction([
      prisma.member.delete({
        where: { id },
      }),
      prisma.user.update({
        where: { id: existing.user_id },
        data: { is_deleted: true },
      }),
    ]);

    return res.status(StatusCodes.OK).json({
      message: "Member deleted successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

