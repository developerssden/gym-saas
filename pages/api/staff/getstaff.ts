// pages/api/staff/getstaff.ts
// Lists the owner's staff accounts, or returns one when `id` is given.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { STAFF_SELECT, findOwnedStaff, staffStatus } from "@/lib/staff";
import { validateOwnerSubscription } from "@/lib/subscription-validation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  // Owners only: staff never manage staff.
  const access = await requireAccess(req, res);
  if (!access) return;
  const ownerId = access.ownerId!;

  try {
    const { id } = (req.body ?? {}) as { id?: string };

    if (id) {
      const staff = await findOwnedStaff(ownerId, id);
      if (!staff) return res.status(StatusCodes.NOT_FOUND).json({ error: "Staff member not found" });
      return res.status(StatusCodes.OK).json({ data: { ...staff, status: staffStatus(staff) } });
    }

    const [staff, validation] = await Promise.all([
      prisma.user.findMany({
        where: { role: "STAFF", staff_owner_id: ownerId, is_deleted: false },
        select: STAFF_SELECT,
        orderBy: { createdAt: "desc" },
      }),
      validateOwnerSubscription(ownerId),
    ]);

    return res.status(StatusCodes.OK).json({
      data: staff.map(s => ({ ...s, status: staffStatus(s) })),
      seats: { used: validation.currentCounts.staff, max: validation.limits.max_staff },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
