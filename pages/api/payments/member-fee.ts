// POST /api/payments/member-fee { member_id }
// What a member should pay right now, for the quick "Record payment" dialog.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess, ownsGym } from "@/lib/access";
import { decideFeeAction } from "@/lib/quick-payment";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res, { permission: ["payments.record", "membersubscriptions.renew"] });
  if (!access) return;

  try {
    const { member_id } = (req.body ?? {}) as { member_id?: string };
    if (!member_id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "member_id is required" });

    const member = await prisma.member.findUnique({
      where: { id: member_id },
      select: {
        id: true,
        gym: { select: { id: true, owner_id: true, is_deleted: true } },
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
    });
    if (!member || member.gym.is_deleted || !ownsGym(access, member.gym)) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Member not found" });
    }

    return res.status(StatusCodes.OK).json({
      member: {
        id: member.id,
        name: `${member.user.first_name ?? ""} ${member.user.last_name ?? ""}`.trim() || "Member",
        phone: member.user.phone_number,
      },
      action: decideFeeAction(
        member.memberSubscriptions.map(s => ({ ...s, billing_model: String(s.billing_model) }))
      ),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
