// pages/api/membersubscriptions/freeze.ts
// Pause a member's subscription. Unfreezing (unfreeze.ts) extends the end date.
import { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess, ownsGym } from "@/lib/access";
import { parseCalendarDay, validateFreezeStart } from "@/lib/subscription-freeze";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res, { permission: "membersubscriptions.freeze" });
  if (!access) return;

  try {
    const { id, start_date, reason } = (req.body ?? {}) as {
      id?: string;
      /** YYYY-MM-DD; defaults to today. */
      start_date?: string;
      reason?: string;
    };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Subscription ID is required" });
    }

    const freezeStart = start_date ? parseCalendarDay(start_date) : new Date();
    if (!freezeStart) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid freeze start date" });
    }
    if (typeof reason === "string" && reason.length > 200) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Keep the reason under 200 characters" });
    }

    const subscription = await prisma.memberSubscription.findUnique({
      where: { id },
      include: { member: { include: { gym: { select: { owner_id: true } } } } },
    });
    if (!subscription || subscription.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Member subscription not found" });
    }
    if (!ownsGym(access, { id: subscription.member.gym_id, owner_id: subscription.member.gym.owner_id })) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – Member subscription does not belong to your gym",
      });
    }

    const error = validateFreezeStart(subscription, freezeStart);
    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.subscriptionFreeze.create({
        data: {
          member_subscription_id: subscription.id,
          start_date: freezeStart,
          reason: typeof reason === "string" ? reason.trim() || null : null,
          frozen_by_id: access.userId,
        },
      });
      return tx.memberSubscription.update({
        where: { id: subscription.id },
        data: { frozen_since: freezeStart },
      });
    });

    return res.status(StatusCodes.OK).json({ message: "Subscription frozen", data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
