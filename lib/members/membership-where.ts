// Database filters for membership status, matching memberStatus() in
// member-status.ts, and the owing calculation shared by the dashboard and the
// members list. Server only.
import prisma from "@/lib/prisma";
import { Prisma, SubscriptionTypeEnum } from "@/prisma/generated/client";
import { calendarDayRange, formatCalendarDate, MS_PER_DAY } from "@/lib/date-utils";
import { EXPIRING_SOON_DAYS, owingByMember } from "@/lib/dashboard";
import {
  memberStatus,
  type MemberStatus,
  type MemberStatusFilter,
  type SubscriptionForStatus,
} from "@/lib/members/member-status";

export function membershipFilters(now = new Date()) {
  const todayStart = calendarDayRange(formatCalendarDate(now))!.start;
  const soonEnd = calendarDayRange(
    formatCalendarDate(new Date(now.getTime() + (EXPIRING_SOON_DAYS + 1) * MS_PER_DAY)),
  )!.start;

  /** Still counts: not expired and not past its end date, or frozen. */
  const current: Prisma.MemberSubscriptionWhereInput = {
    is_deleted: false,
    OR: [{ is_expired: false, end_date: { gte: todayStart } }, { frozen_since: { not: null } }],
  };
  /** Current and good for more than the next 7 days (or frozen). */
  const lasting: Prisma.MemberSubscriptionWhereInput = {
    is_deleted: false,
    OR: [{ is_expired: false, end_date: { gte: soonEnd } }, { frozen_since: { not: null } }],
  };
  /** Ends today or within the next 7 days. */
  const expiring: Prisma.MemberSubscriptionWhereInput = {
    is_deleted: false,
    is_expired: false,
    frozen_since: null,
    end_date: { gte: todayStart, lt: soonEnd },
  };

  /** Member filter for a status (not "owing", which needs balances: see owingMembers). */
  const memberStatusWhere = (status: Exclude<MemberStatusFilter, "owing">): Prisma.MemberWhereInput => {
    if (status === "active") return { memberSubscriptions: { some: lasting } };
    // Expiring, unless they've already renewed past it.
    if (status === "expiring") return { memberSubscriptions: { some: expiring, none: lasting } };
    return { memberSubscriptions: { some: { is_deleted: false }, none: current } };
  };

  return { todayStart, soonEnd, current, lasting, expiring, memberStatusWhere };
}

/**
 * Members with an unpaid balance among `memberWhere`, largest first. Loads fee
 * fields per subscription and payment sums, never individual payments.
 */
export async function owingMembers(memberWhere: Prisma.MemberWhereInput) {
  const [fees, paidRows] = await Promise.all([
    prisma.memberSubscription.findMany({
      where: { is_deleted: false, member: memberWhere },
      select: { id: true, member_id: true, price: true, discount: true, admission_fee: true },
    }),
    prisma.payment.groupBy({
      by: ["member_subscription_id"],
      where: {
        subscription_type: SubscriptionTypeEnum.MEMBER,
        member_subscription_id: { not: null },
        memberSubscription: { member: memberWhere },
      },
      _sum: { amount: true },
    }),
  ]);
  const paid = new Map<string, number>();
  for (const row of paidRows) {
    if (row.member_subscription_id) paid.set(row.member_subscription_id, row._sum.amount ?? 0);
  }
  return owingByMember(fees, paid);
}

/** memberStatus() for each of `memberIds`, from their subscriptions and payment sums. */
export async function statusesForMembers(memberIds: string[], now = new Date()) {
  const statuses = new Map<string, MemberStatus>();
  if (memberIds.length === 0) return statuses;
  const subs = await prisma.memberSubscription.findMany({
    where: { is_deleted: false, member_id: { in: memberIds } },
    select: {
      id: true,
      member_id: true,
      price: true,
      discount: true,
      admission_fee: true,
      billing_model: true,
      start_date: true,
      end_date: true,
      is_expired: true,
      frozen_since: true,
    },
  });
  const paidRows = subs.length
    ? await prisma.payment.groupBy({
        by: ["member_subscription_id"],
        where: { member_subscription_id: { in: subs.map((s) => s.id) } },
        _sum: { amount: true },
      })
    : [];
  const paid = new Map(paidRows.map((r) => [r.member_subscription_id, r._sum.amount ?? 0]));
  const byMember = new Map<string, SubscriptionForStatus[]>();
  for (const s of subs) {
    const list = byMember.get(s.member_id) ?? [];
    list.push({ ...s, paid: paid.get(s.id) ?? 0 });
    byMember.set(s.member_id, list);
  }
  for (const id of memberIds) statuses.set(id, memberStatus(byMember.get(id) ?? [], now));
  return statuses;
}
