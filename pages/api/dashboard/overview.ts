// pages/api/dashboard/overview.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/adminsessioncheck"
import { StatusCodes } from "http-status-codes"
import { SubscriptionTypeEnum } from "@/prisma/generated/client"

type OverviewResponse = {
  totals: {
    totalClients: number
    totalGyms: number
    totalLocations: number
    activeOwnerSubscriptions: number
    expiredOwnerSubscriptions: number
    revenueThisMonth: number
    revenueLastMonth: number
    revenueGrowthPct: number | null
  }
  charts: {
    revenueByMonth: Array<{ month: string; revenue: number }>
    newClientsByMonth: Array<{ month: string; clients: number }>
  }
  tables: {
    activeSubscriptions: Array<{
      id: string
      ownerName: string
      ownerEmail: string
      planName: string
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
      ownerName: string
      ownerEmail: string
      planName: string
      billingModel: string
      startDate: string
      endDate: string
      isActive: boolean
      isExpired: boolean
      lastPaymentAmount: number | null
      lastPaymentDate: string | null
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
  // e.g. "Dec 2025"
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
  res: NextApiResponse<OverviewResponse | { message: string; error?: string }>
) {
  if (req.method !== "POST") {
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" })
  }

  const session = await requireSuperAdmin(req, res)
  if (!session) return

  try {
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
      totalClients,
      totalGyms,
      totalLocations,
      activeOwnerSubscriptions,
      expiredOwnerSubscriptions,
      paymentsThisMonth,
      paymentsLastMonth,
      paymentsForCharts,
      clientCreatedForCharts,
      activeSubsRows,
      expiredSubsRows,
    ] = await Promise.all([
      prisma.user.count({
        where: { is_deleted: false, role: "GYM_OWNER" },
      }),
      prisma.gym.count({
        where: { is_deleted: false },
      }),
      prisma.location.count({
        where: { is_deleted: false },
      }),
      prisma.ownerSubscription.count({
        where: { is_deleted: false, is_active: true, is_expired: false },
      }),
      prisma.ownerSubscription.count({
        where: { is_deleted: false, is_expired: true },
      }),
      prisma.payment.findMany({
        where: {
          subscription_type: SubscriptionTypeEnum.OWNER,
          payment_date: { gte: thisMonthStart, lte: now },
        },
        select: { amount: true, payment_date: true },
      }),
      prisma.payment.findMany({
        where: {
          subscription_type: SubscriptionTypeEnum.OWNER,
          payment_date: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        select: { amount: true, payment_date: true },
      }),
      prisma.payment.findMany({
        where: {
          subscription_type: SubscriptionTypeEnum.OWNER,
          payment_date: { gte: chartFrom, lte: chartTo },
        },
        select: { amount: true, payment_date: true },
        orderBy: { payment_date: "asc" },
      }),
      prisma.user.findMany({
        where: {
          is_deleted: false,
          role: "GYM_OWNER",
          createdAt: { gte: chartFrom, lte: chartTo },
        },
        select: { createdAt: true },
      }),
      prisma.ownerSubscription.findMany({
        where: { is_deleted: false, is_active: true, is_expired: false },
        include: {
          owner: true,
          plan: true,
          payments: {
            orderBy: { payment_date: "desc" },
            take: 1,
            select: { amount: true, payment_date: true },
          },
        },
        orderBy: { end_date: "asc" },
        take: 25,
      }),
      prisma.ownerSubscription.findMany({
        where: { is_deleted: false, is_expired: true },
        include: {
          owner: true,
          plan: true,
          payments: {
            orderBy: { payment_date: "desc" },
            take: 1,
            select: { amount: true, payment_date: true },
          },
        },
        orderBy: { end_date: "desc" },
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
    const revenueByMonth: OverviewResponse["charts"]["revenueByMonth"] = monthKeys.map(
      (m) => {
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`
        return { month: formatMonthLabel(m), revenue: monthTotals.get(key) ?? 0 }
      }
    )

    const clientsByMonthTotals = new Map<string, number>()
    for (const c of clientCreatedForCharts) {
      const d = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt as any)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      clientsByMonthTotals.set(key, (clientsByMonthTotals.get(key) ?? 0) + 1)
    }
    const newClientsByMonth: OverviewResponse["charts"]["newClientsByMonth"] = monthKeys.map(
      (m) => {
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`
        return { month: formatMonthLabel(m), clients: clientsByMonthTotals.get(key) ?? 0 }
      }
    )

    const mapSubRow = (s: any) => {
      const ownerName = `${s.owner?.first_name ?? ""} ${s.owner?.last_name ?? ""}`.trim() || "-"
      const ownerEmail = s.owner?.email ?? "-"
      const planName = s.plan?.name ?? "-"
      const lastPayment = Array.isArray(s.payments) && s.payments.length ? s.payments[0] : null

      return {
        id: s.id,
        ownerName,
        ownerEmail,
        planName,
        billingModel: String(s.billing_model ?? "-"),
        startDate: safeIso(s.start_date),
        endDate: safeIso(s.end_date),
        isActive: Boolean(s.is_active),
        isExpired: Boolean(s.is_expired),
        lastPaymentAmount: lastPayment?.amount ?? null,
        lastPaymentDate: lastPayment?.payment_date ? safeIso(lastPayment.payment_date) : null,
      }
    }

    const response: OverviewResponse = {
      totals: {
        totalClients,
        totalGyms,
        totalLocations,
        activeOwnerSubscriptions,
        expiredOwnerSubscriptions,
        revenueThisMonth,
        revenueLastMonth,
        revenueGrowthPct,
      },
      charts: {
        revenueByMonth,
        newClientsByMonth,
      },
      tables: {
        activeSubscriptions: activeSubsRows.map(mapSubRow),
        expiredSubscriptions: expiredSubsRows.map(mapSubRow),
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


