// pages/api/staff/resendinvite.ts
// Sends a fresh invite link to a staff member who hasn't set up their account.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { findOwnedStaff, sendStaffInvite } from "@/lib/staff";

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
    if (!staff?.email || staff.onboarding_completed) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "No pending invite found for this staff member" });
    }

    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { first_name: true, last_name: true },
    });

    await sendStaffInvite(
      { id: staff.id, email: staff.email },
      owner ?? { first_name: null, last_name: null },
      staff.staff_gym?.name ?? "your gym",
      true
    );

    return res.status(StatusCodes.OK).json({ message: "Invite resent" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
