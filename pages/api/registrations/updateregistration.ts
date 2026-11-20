// pages/api/registrations/updateregistration.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { RegistrationStatus } from "@/prisma/generated/client";
import { REGISTRATION_STATUSES } from "@/lib/registrations/schema";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { id, status, admin_note } = (req.body ?? {}) as {
      id?: string;
      status?: string;
      admin_note?: string | null;
    };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Registration ID is required" });
    }
    if (status !== undefined && !(REGISTRATION_STATUSES as readonly string[]).includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: `Invalid status. Must be one of ${REGISTRATION_STATUSES.join(", ")}`,
      });
    }
    if (admin_note !== undefined && admin_note !== null && typeof admin_note !== "string") {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "admin_note must be text" });
    }

    const existing = await prisma.gymRegistration.findUnique({ where: { id } });
    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Registration not found" });
    }

    const updated = await prisma.gymRegistration.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status: status as RegistrationStatus } : {}),
        ...(admin_note !== undefined ? { admin_note: admin_note?.trim() || null } : {}),
      },
    });

    return res.status(StatusCodes.OK).json({ message: "Registration updated", data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
