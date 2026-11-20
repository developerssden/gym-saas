// pages/api/expenses/cashbook.ts
// Daily cash book: member payments collected vs expenses for one calendar day.
import { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { SubscriptionTypeEnum } from "@/prisma/generated/client";
import { calendarDayRange, formatCalendarDate } from "@/lib/date-utils";
import { profit } from "@/lib/expenses";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { day, gym_id, location_id } = (req.body ?? {}) as {
      /** YYYY-MM-DD in the business time zone; defaults to today. */
      day?: string;
      gym_id?: string;
      location_id?: string;
    };

    const selectedDay = day || formatCalendarDate(new Date());
    const range = calendarDayRange(selectedDay);
    if (!range) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid date" });

    const gymFilter = {
      owner_id: session.user.id,
      is_deleted: false,
      ...(gym_id ? { id: gym_id } : {}),
    };

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: {
          subscription_type: SubscriptionTypeEnum.MEMBER,
          payment_date: { gte: range.start, lt: range.end },
          memberSubscription: {
            member: { gym: gymFilter, ...(location_id ? { location_id } : {}) },
          },
        },
        select: {
          id: true,
          amount: true,
          payment_method: true,
          payment_date: true,
          memberSubscription: {
            select: {
              member: { select: { user: { select: { first_name: true, last_name: true } } } },
            },
          },
        },
        orderBy: { payment_date: "asc" },
      }),
      prisma.expense.findMany({
        where: {
          is_deleted: false,
          expense_date: { gte: range.start, lt: range.end },
          gym: gymFilter,
          ...(location_id ? { location_id } : {}),
        },
        select: { id: true, amount: true, category: true, note: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const collected = payments.reduce((sum, p) => sum + p.amount, 0);
    const spent = expenses.reduce((sum, e) => sum + e.amount, 0);

    return res.status(StatusCodes.OK).json({
      day: selectedDay,
      collected,
      spent,
      net: profit(collected, spent),
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        payment_method: p.payment_method,
        payment_date: p.payment_date,
        member_name:
          `${p.memberSubscription?.member.user.first_name ?? ""} ${p.memberSubscription?.member.user.last_name ?? ""}`.trim() ||
          "Member",
      })),
      expenses,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
