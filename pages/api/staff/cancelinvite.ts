// pages/api/staff/cancelinvite.ts
// Withdraws an invite that hasn't been accepted yet, freeing the seat.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { findOwnedStaff } from "@/lib/staff";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res);
  if (!access) return;
  const ownerId = access.ownerId!;

  try {
    const { id } = (req.body ?? {}) as { id?: string };
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Staff ID is required" });

    const staff = await findOwnedStaff(ownerId, id);
    if (!staff || staff.onboarding_completed) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "No pending invite found for this staff member" });
    }

    await prisma.$transaction([
      prisma.inviteToken.updateMany({ where: { user_id: staff.id, used: false }, data: { used: true } }),
      prisma.user.update({ where: { id: staff.id }, data: { is_deleted: true } }),
    ]);

    return res.status(StatusCodes.OK).json({ message: "Invite cancelled" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
