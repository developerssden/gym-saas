// POST /api/payments/offline-directory { gym_id?, location_id? }
// Every member in scope with what they should pay now. The app keeps this on
// the device so fees can be recorded with no connection.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess, gymScope } from "@/lib/access";
import { decideFeeAction } from "@/lib/quick-payment";
import type { DirectoryMember } from "@/lib/offline/outbox-types";

/** Big enough for any single gym; protects the request if it isn't. */
const MAX_MEMBERS = 3000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res, { permission: ["payments.record", "membersubscriptions.renew"] });
  if (!access) return;

  try {
    const { gym_id, location_id } = (req.body ?? {}) as { gym_id?: string; location_id?: string };
    const members = await prisma.member.findMany({
      where: {
        ...gymScope(access),
        ...(gym_id ? { gym_id } : {}),
        ...(location_id ? { location_id } : {}),
      },
      select: {
        id: true,
        user: { select: { first_name: true, last_name: true, phone_number: true } },
        memberSubscriptions: {
          where: { is_deleted: false },
          select: {
            id: true,
            price: true,
            discount: true,
            admission_fee: true,
            billing_model: true,
            end_date: true,
            is_active: true,
            is_expired: true,
            createdAt: true,
            payments: { select: { amount: true } },
          },
        },
      },
      orderBy: { user: { first_name: "asc" } },
      take: MAX_MEMBERS,
    });

    const data: DirectoryMember[] = members.map(m => ({
      id: m.id,
      name: `${m.user.first_name ?? ""} ${m.user.last_name ?? ""}`.trim() || "Member",
      phone: m.user.phone_number ?? null,
      action: decideFeeAction(m.memberSubscriptions.map(s => ({ ...s, billing_model: String(s.billing_model) }))),
    }));
    return res.status(StatusCodes.OK).json({ data, savedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
