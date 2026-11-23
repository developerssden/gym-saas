// pages/api/dashboard/owner-overview.ts
// Owner/staff dashboard: who to chase today, the month's money and trends.
import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/lib/prisma"
import { requireAccess, ownedGymWhere, can } from "@/lib/access"
import { StatusCodes } from "http-status-codes"
import { Prisma, SubscriptionTypeEnum } from "@/prisma/generated/client"
import { profit } from "@/lib/expenses"
import { calendarMonthRange, formatCalendarMonth, previousCalendarMonth } from "@/lib/date-utils"
import { membershipFilters, owingMembers } from "@/lib/members/membership-where"
import {
  ATTENTION_ROW_LIMIT,
  RECENT_PAYMENTS_LIMIT,
  chartMonths,
  growthPct,
  longMonthName,
  monthLabel,
  parseChartRange,
  type ChartRange,
} from "@/lib/dashboard"

export type AttentionRow = {
  subscriptionId: string
  memberId: string
  memberName: string
  phone: string | null
  billingModel: string
  /** Pre-fills Renew. Only displayed when canSeeRowAmounts. */
  price: number
  endDate: string
}

export type OwingRow = AttentionRow & {
  /** Total unpaid across the member's subscriptions; null when the viewer may not see money. */
  balance: number | null
}

export type OwnerOverviewResponse = {
  context: { currentMonth: string; monthName: string; lastMonthName: string }
  /** Whether money figures are included (owners, staff with dashboard.revenue). */
  canSeeMoney: boolean
  /** Whether row prices and balances may be shown (money or payments.view). */
  canSeeRowAmounts: boolean
  totals: {
    totalMembers: number
    /** Members with a current (or frozen) membership. */
    activeMembers: number
    newMembersThisMonth: number
    gyms: number
    locations: number
    equipment: number
    collectedThisMonth: number | null
    collectedLastMonth: number | null
    growthPct: number | null
    expensesThisMonth: number | null
    profitThisMonth: number | null
    outstandingAmount: number | null
    owingMembers: number
    expiringSoonCount: number
    /** Sum of the expiring memberships' prices: money coming up for renewal. */
    expiringSoonAmount: number | null
    expiredCount: number
  }
  /** Up to ATTENTION_ROW_LIMIT rows each; the counts above say how many there are in all. */
  attention: {
    expiringSoon: AttentionRow[]
    expired: AttentionRow[]
    owing: OwingRow[]
  }
  charts: {
    range: ChartRange
    months: Array<{ month: string; label: string; revenue: number | null; members: number }>
  }
  /** Empty when the viewer may not see payments. */
  recentPayments: Array<{
    id: string
    memberName: string
    amount: number
    paymentMethod: string
    paymentDate: string
  }>
}

const memberName = (user?: { first_name: string | null; last_name: string | null } | null) =>
  `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "Member"

const iso = (d: Date) => d.toISOString()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OwnerOverviewResponse | { message: string; error?: string }>
) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" })
  }

  const access = await requireAccess(req, res, { permission: "dashboard.view" })
  if (!access) return

  try {
    // Totals, profit and charts need dashboard.revenue. Amounts on member rows
    // also show for staff who can see payments (they see them on Payments anyway).
    const canSeeMoney = can(access, "dashboard.revenue")
    const canSeePayments = canSeeMoney || can(access, "payments.view")
    const rowMoney = canSeePayments
    const { gym_id, location_id } = req.body as { gym_id?: string; location_id?: string }
    const range = parseChartRange(req.body?.range)

    const gymWhere: Prisma.GymWhereInput = {
      AND: [ownedGymWhere(access)],
      is_deleted: false,
      ...(gym_id ? { id: gym_id } : {}),
    }
    const memberWhere: Prisma.MemberWhereInput = {
      gym: gymWhere,
      ...(location_id ? { location_id } : {}),
    }

    const now = new Date()
    const currentMonth = formatCalendarMonth(now)
    const lastMonthKey = previousCalendarMonth(currentMonth)
    const thisMonth = calendarMonthRange(currentMonth)!
    const lastMonth = calendarMonthRange(lastMonthKey)!
    // Same rules as the members list badges and filters.
    const { todayStart, current: currentSub, lasting, expiring } = membershipFilters(now)
    // Ending within 7 days, unless the member has already renewed past it.
    const expiringWhere: Prisma.MemberSubscriptionWhereInput = {
      ...expiring,
      is_active: true,
      member: { ...memberWhere, memberSubscriptions: { none: lasting } },
    }
    // Members whose last membership ran out and who haven't renewed or told us why they left.
    const expiredMemberWhere: Prisma.MemberWhereInput = {
      ...memberWhere,
      memberSubscriptions: {
        some: { is_deleted: false, churn_reason: null, OR: [{ is_expired: true }, { end_date: { lt: todayStart } }] },
        none: currentSub,
      },
    }
    const memberPayments: Prisma.PaymentWhereInput = {
      subscription_type: SubscriptionTypeEnum.MEMBER,
      memberSubscription: { member: memberWhere },
    }
    const months = chartMonths(range, currentMonth)
    const monthRanges = months.map((m) => calendarMonthRange(m)!)

    const rowSelect = {
      id: true,
      member_id: true,
      price: true,
      billing_model: true,
      end_date: true,
      member: { select: { user: { select: { first_name: true, last_name: true, phone_number: true } } } },
    } satisfies Prisma.MemberSubscriptionSelect

    const [
      totalMembers,
      activeMembers,
      newMembersThisMonth,
      gyms,
      locations,
      equipment,
      collectedThisMonth,
      collectedLastMonth,
      expenses,
      expiringSoonCount,
      expiringSoonSum,
      expiringRows,
      expiredCount,
      expiredRows,
      owing,
      revenueByMonth,
      membersByMonth,
      recentPayments,
    ] = await Promise.all([
      prisma.member.count({ where: memberWhere }),
      prisma.member.count({ where: { ...memberWhere, memberSubscriptions: { some: currentSub } } }),
      prisma.member.count({ where: { ...memberWhere, joinedAt: { gte: thisMonth.start, lt: thisMonth.end } } }),
      prisma.gym.count({ where: gymWhere }),
      prisma.location.count({ where: { gym: gymWhere, is_deleted: false, ...(location_id ? { id: location_id } : {}) } }),
      prisma.equipment.count({ where: { gym: gymWhere, is_deleted: false, ...(location_id ? { location_id } : {}) } }),
      canSeeMoney
        ? prisma.payment.aggregate({
            where: { ...memberPayments, payment_date: { gte: thisMonth.start, lt: thisMonth.end } },
            _sum: { amount: true },
          })
        : null,
      canSeeMoney
        ? prisma.payment.aggregate({
            where: { ...memberPayments, payment_date: { gte: lastMonth.start, lt: lastMonth.end } },
            _sum: { amount: true },
          })
        : null,
      canSeeMoney
        ? prisma.expense.aggregate({
            where: {
              is_deleted: false,
              expense_date: { gte: thisMonth.start, lt: thisMonth.end },
              gym: gymWhere,
              ...(location_id ? { location_id } : {}),
            },
            _sum: { amount: true },
          })
        : null,
      prisma.memberSubscription.count({ where: expiringWhere }),
      canSeeMoney ? prisma.memberSubscription.aggregate({ where: expiringWhere, _sum: { price: true } }) : null,
      prisma.memberSubscription.findMany({
        where: expiringWhere,
        select: rowSelect,
        orderBy: { end_date: "asc" },
        take: ATTENTION_ROW_LIMIT,
      }),
      prisma.member.count({ where: expiredMemberWhere }),
      // Latest expired membership of members who haven't renewed; deduplicated below.
      prisma.memberSubscription.findMany({
        where: {
          is_deleted: false,
          churn_reason: null,
          OR: [{ is_expired: true }, { end_date: { lt: todayStart } }],
          member: { memberSubscriptions: { none: currentSub }, ...memberWhere },
        },
        select: rowSelect,
        orderBy: { end_date: "desc" },
        take: ATTENTION_ROW_LIMIT * 6,
      }),
      // Owing: fee fields and payment sums per subscription, no payment rows loaded.
      owingMembers(memberWhere),
      canSeeMoney
        ? Promise.all(
            monthRanges.map((r) =>
              prisma.payment.aggregate({
                where: { ...memberPayments, payment_date: { gte: r.start, lt: r.end } },
                _sum: { amount: true },
              })
            )
          )
        : null,
      Promise.all(
        monthRanges.map((r) => prisma.member.count({ where: { ...memberWhere, joinedAt: { gte: r.start, lt: r.end } } }))
      ),
      canSeePayments
        ? prisma.payment.findMany({
            where: memberPayments,
            select: {
              id: true,
              amount: true,
              payment_method: true,
              payment_date: true,
              memberSubscription: {
                select: { member: { select: { user: { select: { first_name: true, last_name: true } } } } },
              },
            },
            orderBy: [{ payment_date: "desc" }, { createdAt: "desc" }],
            take: RECENT_PAYMENTS_LIMIT,
          })
        : [],
    ])

    const outstandingAmount = owing.reduce((sum, o) => sum + o.balance, 0)

    // Names, phones and plans for the members shown on the Owing tab.
    const owingTop = owing.slice(0, ATTENTION_ROW_LIMIT)
    const owingSubs = owingTop.length
      ? await prisma.memberSubscription.findMany({
          where: { id: { in: owingTop.map((o) => o.subscriptionId) } },
          select: rowSelect,
        })
      : []
    const owingSubById = new Map(owingSubs.map((s) => [s.id, s]))

    type SubRow = (typeof expiringRows)[number]
    const toRow = (s: SubRow): AttentionRow => ({
      subscriptionId: s.id,
      memberId: s.member_id,
      memberName: memberName(s.member.user),
      phone: s.member.user.phone_number ?? null,
      billingModel: s.billing_model,
      price: s.price,
      endDate: iso(s.end_date),
    })

    const seen = new Set<string>()
    const expired = expiredRows
      .filter((s) => (seen.has(s.member_id) ? false : (seen.add(s.member_id), true)))
      .slice(0, ATTENTION_ROW_LIMIT)
      .map(toRow)

    const collected = collectedThisMonth?._sum.amount ?? 0
    const collectedBefore = collectedLastMonth?._sum.amount ?? 0
    const spent = expenses?._sum.amount ?? 0
    const multiYear = months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4)

    const response: OwnerOverviewResponse = {
      context: {
        currentMonth,
        monthName: longMonthName(currentMonth),
        lastMonthName: longMonthName(lastMonthKey),
      },
      canSeeMoney,
      canSeeRowAmounts: rowMoney,
      totals: {
        totalMembers,
        activeMembers,
        newMembersThisMonth,
        gyms,
        locations,
        equipment,
        collectedThisMonth: canSeeMoney ? collected : null,
        collectedLastMonth: canSeeMoney ? collectedBefore : null,
        growthPct: canSeeMoney ? growthPct(collected, collectedBefore) : null,
        expensesThisMonth: canSeeMoney ? spent : null,
        profitThisMonth: canSeeMoney ? profit(collected, spent) : null,
        outstandingAmount: canSeeMoney ? outstandingAmount : null,
        owingMembers: owing.length,
        expiringSoonCount,
        expiringSoonAmount: canSeeMoney ? expiringSoonSum?._sum.price ?? 0 : null,
        expiredCount,
      },
      attention: {
        expiringSoon: expiringRows.map(toRow),
        expired,
        owing: owingTop.flatMap((o) => {
          const sub = owingSubById.get(o.subscriptionId)
          return sub ? [{ ...toRow(sub), balance: rowMoney ? o.balance : null }] : []
        }),
      },
      charts: {
        range,
        months: months.map((m, i) => ({
          month: m,
          label: monthLabel(m, multiYear),
          revenue: revenueByMonth ? revenueByMonth[i]._sum.amount ?? 0 : null,
          members: membersByMonth[i],
        })),
      },
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        memberName: memberName(p.memberSubscription?.member.user),
        amount: p.amount,
        paymentMethod: p.payment_method,
        paymentDate: iso(p.payment_date),
      })),
    }

    return res.status(StatusCodes.OK).json(response)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to load dashboard overview", error: message })
  }
}
