// pages/api/membersubscriptions/unfreeze.ts
// End a freeze and push the subscription's end date out by the frozen days.
import { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { isExpiredOrToday } from "@/lib/date-utils";
import { notificationLifecycleReset } from "@/lib/subscription-lifecycle";
import { computeUnfreeze, parseCalendarDay } from "@/lib/subscription-freeze";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { id, back_on } = (req.body ?? {}) as {
      id?: string;
      /** YYYY-MM-DD, the first day the member is back; defaults to today. */
      back_on?: string;
    };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Subscription ID is required" });
    }

    const backOn = back_on ? parseCalendarDay(back_on) : new Date();
    if (!backOn) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid return date" });
    }

    const subscription = await prisma.memberSubscription.findUnique({
      where: { id },
      include: {
        member: { include: { gym: { select: { owner_id: true } } } },
        freezes: { where: { end_date: null }, orderBy: { start_date: "desc" }, take: 1 },
      },
    });
    if (!subscription || subscription.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Member subscription not found" });
    }
    if (subscription.member.gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – Member subscription does not belong to your gym",
      });
    }

    const result = computeUnfreeze(subscription, backOn);
    if (!result.ok) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: result.error });
    }

    const openFreeze = subscription.freezes[0];
    const updated = await prisma.$transaction(async (tx) => {
      if (openFreeze) {
        await tx.subscriptionFreeze.update({
          where: { id: openFreeze.id },
          data: { end_date: backOn, days: result.days, unfrozen_by_id: session.user.id },
        });
      }
      return tx.memberSubscription.update({
        where: { id: subscription.id },
        data: {
          frozen_since: null,
          end_date: result.newEndDate,
          is_expired: isExpiredOrToday(result.newEndDate),
          // A later end date starts a fresh reminder/expiry lifecycle.
          ...notificationLifecycleReset(subscription.end_date, result.newEndDate),
        },
      });
    });

    return res.status(StatusCodes.OK).json({
      message: "Subscription unfrozen",
      data: updated,
      days_added: result.days,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
