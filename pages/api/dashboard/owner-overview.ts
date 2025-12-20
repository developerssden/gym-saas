// pages/api/dashboard/owner-overview.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/lib/prisma"
import { requireGymOwner } from "@/lib/ownersessioncheck"
import { StatusCodes } from "http-status-codes"
import { SubscriptionTypeEnum } from "@/prisma/generated/client"

type OwnerOverviewResponse = {
  totals: {
    totalMembers: number
    totalGyms: number
    totalLocations: number
    totalEquipment: number
    activeMemberSubscriptions: number
    expiredMemberSubscriptions: number
    revenueThisMonth: number
    revenueLastMonth: number
    revenueGrowthPct: number | null
  }
  charts: {
    revenueByMonth: Array<{ month: string; revenue: number }>
    newMembersByMonth: Array<{ month: string; members: number }>
  }
  tables: {
    activeSubscriptions: Array<{
      id: string
      memberName: string
      memberEmail: string
      price: number
      billingModel: string
      startDate: string
      endDate: string
      isActive: boolean
      isExpired: boolean
      lastPaymentAmount: number | null
      lastPaymentDate: string | null
    }>
    expiredSubscriptions: Array<{
      id: string
      memberName: string
      memberEmail: string
      price: number
      billingModel: string
      startDate: string
      endDate: string
      isActive: boolean
      isExpired: boolean
      lastPaymentAmount: number | null
      lastPaymentDate: string | null
    }>
    recentPayments: Array<{
      id: string
      memberName: string
      amount: number
      paymentMethod: string
      paymentDate: string
      subscriptionType: string
    }>
  }
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1, 0, 0, 0, 0)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function formatMonthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
}

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function safeIso(d: unknown) {
  const date = d instanceof Date ? d : new Date(d as any)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OwnerOverviewResponse | { message: string; error?: string }>
) {
  if (req.method !== "POST") {
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" })
  }

  const session = await requireGymOwner(req, res)
  if (!session) return

  try {
    const ownerId = session.user.id
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const lastMonthStart = addMonths(thisMonthStart, -1)
    const lastMonthEnd = endOfMonth(lastMonthStart)

    // Optional chart range override
    const requestedFrom = parseDate(req.body?.from)
    const requestedTo = parseDate(req.body?.to)
    let chartFrom = requestedFrom ? startOfDay(requestedFrom) : thisMonthStart
    let chartTo = requestedTo ? requestedTo : now
    if (chartTo.getTime() > now.getTime()) chartTo = now
    if (chartFrom.getTime() > chartTo.getTime()) {
      ;[chartFrom, chartTo] = [startOfDay(chartTo), chartFrom]
    }

    const [
      totalMembers,
      totalGyms,
      totalLocations,
      totalEquipment,
      activeMemberSubscriptions,
      expiredMemberSubscriptions,
      paymentsThisMonth,
      paymentsLastMonth,
      paymentsForCharts,
      membersCreatedForCharts,
      activeSubsRows,
      expiredSubsRows,
      recentPaymentsRows,
    ] = await Promise.all([
      // Total members
      prisma.member.count({
        where: {
          gym: {
            owner_id: ownerId,
            is_deleted: false,
          },
        },
      }),
      // Total gyms
      prisma.gym.count({
        where: {
          owner_id: ownerId,
          is_deleted: false,
        },
      }),
      // Total locations
      prisma.location.count({
        where: {
          gym: {
            owner_id: ownerId,
            is_deleted: false,
          },
          is_deleted: false,
        },
      }),
      // Total equipment
      prisma.equipment.count({
        where: {
          gym: {
            owner_id: ownerId,
            is_deleted: false,
          },
          is_deleted: false,
        },
      }),
      // Active member subscriptions
      prisma.memberSubscription.count({
        where: {
          is_deleted: false,
          is_active: true,
          is_expired: false,
          member: {
            gym: {
              owner_id: ownerId,
              is_deleted: false,
            },
          },
        },
      }),
      // Expired member subscriptions
      prisma.memberSubscription.count({
        where: {
          is_deleted: false,
          is_expired: true,
          member: {
            gym: {
              owner_id: ownerId,
              is_deleted: false,
            },
          },
        },
      }),
      // Payments this month
      prisma.payment.findMany({
        where: {
          subscription_type: SubscriptionTypeEnum.MEMBER,
          payment_date: { gte: thisMonthStart, lte: now },
          memberSubscription: {
            member: {
              gym: {
                owner_id: ownerId,
                is_deleted: false,
              },
            },
          },
        },
        select: { amount: true, payment_date: true },
      }),
      // Payments last month
      prisma.payment.findMany({
        where: {
          subscription_type: SubscriptionTypeEnum.MEMBER,
          payment_date: { gte: lastMonthStart, lte: lastMonthEnd },
          memberSubscription: {
            member: {
              gym: {
                owner_id: ownerId,
                is_deleted: false,
              },
            },
          },
        },
        select: { amount: true, payment_date: true },
      }),
      // Payments for charts
      prisma.payment.findMany({
        where: {
          subscription_type: SubscriptionTypeEnum.MEMBER,
          payment_date: { gte: chartFrom, lte: chartTo },
          memberSubscription: {
            member: {
              gym: {
                owner_id: ownerId,
                is_deleted: false,
              },
            },
          },
        },
        select: { amount: true, payment_date: true },
        orderBy: { payment_date: "asc" },
      }),
      // Members created for charts
      prisma.member.findMany({
        where: {
          gym: {
            owner_id: ownerId,
            is_deleted: false,
          },
          joinedAt: { gte: chartFrom, lte: chartTo },
        },
        select: { joinedAt: true },
      }),
      // Active subscriptions
      prisma.memberSubscription.findMany({
        where: {
          is_deleted: false,
          is_active: true,
          is_expired: false,
          member: {
            gym: {
              owner_id: ownerId,
              is_deleted: false,
            },
          },
        },
        include: {
          member: {
            include: {
              user: true,
            },
          },
          payments: {
            orderBy: { payment_date: "desc" },
            take: 1,
            select: { amount: true, payment_date: true },
          },
        },
        orderBy: { end_date: "asc" },
        take: 25,
      }),
      // Expired subscriptions
      prisma.memberSubscription.findMany({
        where: {
          is_deleted: false,
          is_expired: true,
          member: {
            gym: {
              owner_id: ownerId,
              is_deleted: false,
            },
          },
        },
        include: {
          member: {
            include: {
              user: true,
            },
          },
          payments: {
            orderBy: { payment_date: "desc" },
            take: 1,
            select: { amount: true, payment_date: true },
          },
        },
        orderBy: { end_date: "desc" },
        take: 25,
      }),
      // Recent payments
      prisma.payment.findMany({
        where: {
          subscription_type: SubscriptionTypeEnum.MEMBER,
          memberSubscription: {
            member: {
              gym: {
                owner_id: ownerId,
                is_deleted: false,
              },
            },
          },
        },
        include: {
          memberSubscription: {
            include: {
              member: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: { payment_date: "desc" },
        take: 25,
      }),
    ])

    const revenueThisMonth = paymentsThisMonth.reduce(
      (sum, p) => sum + (p.amount ?? 0),
      0
    )
    const revenueLastMonth = paymentsLastMonth.reduce(
      (sum, p) => sum + (p.amount ?? 0),
      0
    )
    const revenueGrowthPct =
      revenueLastMonth > 0
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
        : null

    // Revenue by month (selected chart range, capped to 12 months)
    const monthKeys: Date[] = []
    {
      let m = startOfMonth(chartFrom)
      const end = startOfMonth(chartTo)
      while (m.getTime() <= end.getTime()) {
        monthKeys.push(new Date(m))
        m = addMonths(m, 1)
      }
      if (monthKeys.length > 12) {
        monthKeys.splice(0, monthKeys.length - 12)
      }
    }
    const monthTotals = new Map<string, number>()
    for (const p of paymentsForCharts) {
      const d = p.payment_date instanceof Date ? p.payment_date : new Date(p.payment_date as any)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + (p.amount ?? 0))
    }
    const revenueByMonth: OwnerOverviewResponse["charts"]["revenueByMonth"] = monthKeys.map(
      (m) => {
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`
        return { month: formatMonthLabel(m), revenue: monthTotals.get(key) ?? 0 }
      }
    )

    // New members by month
    const membersByMonthTotals = new Map<string, number>()
    for (const m of membersCreatedForCharts) {
      const d = m.joinedAt instanceof Date ? m.joinedAt : new Date(m.joinedAt as any)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      membersByMonthTotals.set(key, (membersByMonthTotals.get(key) ?? 0) + 1)
    }
    const newMembersByMonth: OwnerOverviewResponse["charts"]["newMembersByMonth"] = monthKeys.map(
      (m) => {
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`
        return { month: formatMonthLabel(m), members: membersByMonthTotals.get(key) ?? 0 }
      }
    )

    const mapSubRow = (s: any) => {
      const memberName = `${s.member?.user?.first_name ?? ""} ${s.member?.user?.last_name ?? ""}`.trim() || "-"
      const memberEmail = s.member?.user?.email ?? "-"
      const lastPayment = Array.isArray(s.payments) && s.payments.length ? s.payments[0] : null

      return {
        id: s.id,
        memberName,
        memberEmail,
        price: s.price ?? 0,
        billingModel: String(s.billing_model ?? "-"),
        startDate: safeIso(s.start_date),
        endDate: safeIso(s.end_date),
        isActive: Boolean(s.is_active),
        isExpired: Boolean(s.is_expired),
        lastPaymentAmount: lastPayment?.amount ?? null,
        lastPaymentDate: lastPayment?.payment_date ? safeIso(lastPayment.payment_date) : null,
      }
    }

    const mapPaymentRow = (p: any) => {
      const memberName = `${p.memberSubscription?.member?.user?.first_name ?? ""} ${p.memberSubscription?.member?.user?.last_name ?? ""}`.trim() || "-"

      return {
        id: p.id,
        memberName,
        amount: p.amount ?? 0,
        paymentMethod: String(p.payment_method ?? "-"),
        paymentDate: safeIso(p.payment_date),
        subscriptionType: String(p.subscription_type ?? "-"),
      }
    }

    const response: OwnerOverviewResponse = {
      totals: {
        totalMembers,
        totalGyms,
        totalLocations,
        totalEquipment,
        activeMemberSubscriptions,
        expiredMemberSubscriptions,
        revenueThisMonth,
        revenueLastMonth,
        revenueGrowthPct,
      },
      charts: {
        revenueByMonth,
        newMembersByMonth,
      },
      tables: {
        activeSubscriptions: activeSubsRows.map(mapSubRow),
        expiredSubscriptions: expiredSubsRows.map(mapSubRow),
        recentPayments: recentPaymentsRows.map(mapPaymentRow),
      },
    }

    return res.status(StatusCodes.OK).json(response)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to load dashboard overview", error: message })
  }
}

