"use client"

import * as React from "react"
import axios from "axios"
import Link from "next/link"
import { format as formatDateFns } from "date-fns"
import { useSession } from "next-auth/react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowDown, ArrowRight, ArrowUp, Plus, RefreshCw } from "lucide-react"

import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import DataFetchError from "@/components/common/DataFetchError"
import RenewMemberModal from "@/components/dashboard/RenewMemberModal"
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog"
import OwnerSubscriptionBanner from "@/components/dashboard/OwnerSubscriptionBanner"
import SetupChecklist from "@/components/dashboard/SetupChecklist"
import { NeedsAttention, type AttentionTab } from "@/components/dashboard/NeedsAttention"
import { DashboardTrends } from "@/components/dashboard/DashboardTrends"
import { useGymCurrency } from "@/hooks/useGymCurrency"
import { usePermissions } from "@/hooks/usePermissions"
import { formatDate, formatDateTime, paymentMethodLabel } from "@/lib/format"
import { initials, type ChartRange } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import type { AttentionRow, OwingRow, OwnerOverviewResponse } from "@/pages/api/dashboard/owner-overview"

function OwnerDashboardSkeleton() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl border bg-card" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-[420px] rounded-xl border bg-card" />
          <Skeleton className="h-[260px] rounded-xl border bg-card" />
        </div>
      </div>
    </PageContainer>
  )
}

/** One headline number with a line of context under it. */
function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: "due" | "bad" | "good"
}) {
  return (
    <Card className="gap-1 px-4 py-4 sm:px-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-heading text-2xl font-extrabold tabular-nums tracking-tight break-words sm:text-[2rem] sm:leading-tight",
          tone === "due" && "text-amber-700 dark:text-amber-400",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-primary-dim"
        )}
      >
        {value}
      </p>
      {sub && <div className="text-[13px] text-muted-foreground">{sub}</div>}
    </Card>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

const OwnerDashboard = () => {
  const { data: session } = useSession()
  const { can, isStaff } = usePermissions()
  const { format: money } = useGymCurrency()
  const selectedGymId = session?.user?.selected_gym_id
  const selectedLocationId = session?.user?.selected_location_id
  const gymName = session?.user?.gyms?.find((g) => g.id === selectedGymId)?.name ?? null
  const locationName = session?.user?.locations?.find((l) => l.id === selectedLocationId)?.name ?? null
  const firstName = session?.user?.first_name || session?.user?.name?.split(" ")[0] || ""

  const canRemind = can("membersubscriptions.whatsapp")
  const canRenew = can("membersubscriptions.renew")
  const canRecordPayment = can("payments.record") || canRenew
  const canAddMember = can("members.create")

  const [range, setRange] = React.useState<ChartRange>("6m")
  const [tab, setTab] = React.useState<AttentionTab>("expiring")
  const [tabChosen, setTabChosen] = React.useState(false)
  const [renewTarget, setRenewTarget] = React.useState<AttentionRow | null>(null)
  const [payTarget, setPayTarget] = React.useState<OwingRow | null>(null)
  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine)
    updateOnline()
    window.addEventListener("online", updateOnline)
    window.addEventListener("offline", updateOnline)
    return () => {
      window.removeEventListener("online", updateOnline)
      window.removeEventListener("offline", updateOnline)
    }
  }, [])

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery<OwnerOverviewResponse, Error>({
    queryKey: ["ownerDashboardOverview", range, selectedGymId, selectedLocationId],
    queryFn: async () =>
      (
        await axios.post<OwnerOverviewResponse>("/api/dashboard/owner-overview", {
          range,
          gym_id: selectedGymId || undefined,
          location_id: selectedLocationId || undefined,
        })
      ).data,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    networkMode: "offlineFirst",
  })

  // Open the first tab that has someone in it, until the owner picks one.
  React.useEffect(() => {
    if (!data || tabChosen) return
    const first: AttentionTab =
      data.totals.expiringSoonCount > 0 ? "expiring" : data.totals.expiredCount > 0 ? "expired" : data.totals.owingMembers > 0 ? "owing" : "expiring"
    setTab(first)
  }, [data, tabChosen])

  const chooseTab = (next: AttentionTab) => {
    setTabChosen(true)
    setTab(next)
  }

  const showOwing = () => {
    chooseTab("owing")
    document.getElementById("needs-attention")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (isLoading && !data) return <OwnerDashboardSkeleton />

  if (error && !data) {
    return (
      <PageContainer>
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message={!isOnline ? "No saved dashboard for this gym and branch while offline" : "Couldn't load the dashboard"}
        />
      </PageContainer>
    )
  }

  if (!data) return null

  const { totals, canSeeMoney } = data
  const place = [gymName, locationName].filter(Boolean).join(", ")
  const today = formatDateFns(new Date(), "EEEE, d MMMM")
  const growth = totals.growthPct

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader
          className="mb-0"
          title="Dashboard"
          titleAddon={
            isFetching && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
                <RefreshCw className="size-3 animate-spin" aria-hidden />
                Updating
              </span>
            )
          }
          description={
            <>
              {firstName ? `Assalam-o-Alaikum, ${firstName}` : "Assalam-o-Alaikum"}
              <span className="block sm:inline">
                <span className="hidden sm:inline"> · </span>
                {today}
                {place && ` · ${place}`}
              </span>
            </>
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh dashboard"
                className="!min-w-0 !flex-none px-3"
              >
                <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
              </Button>
              {canAddMember && (
                <Button asChild>
                  <Link href="/members/manage?action=create">
                    <Plus aria-hidden /> Add member
                  </Link>
                </Button>
              )}
            </>
          }
        />

        {/* Plan and billing are the owner's business. */}
        {!isStaff && <OwnerSubscriptionBanner />}
        {!isStaff && <SetupChecklist />}

        {!isOnline && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Showing saved data from {dataUpdatedAt > 0 ? formatDateTime(dataUpdatedAt) : "an earlier visit"}. Reconnect to refresh.
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <span>Couldn&apos;t refresh the dashboard. Showing the last results.</span>
            <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Four key numbers. Staff without the revenue permission get counts instead of money. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <KpiCard
            label="Active members"
            value={totals.activeMembers.toLocaleString()}
            sub={totals.newMembersThisMonth > 0 ? `+${totals.newMembersThisMonth} joined this month` : `${totals.totalMembers.toLocaleString()} members in all`}
          />
          {canSeeMoney ? (
            <KpiCard
              label="Collected this month"
              value={money(totals.collectedThisMonth ?? 0)}
              sub={
                growth === null ? (
                  `Nothing collected in ${data.context.lastMonthName}`
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-x-1">
                    <span className={cn("inline-flex items-center font-medium", growth >= 0 ? "text-primary-dim" : "text-destructive")}>
                      {growth >= 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                      {Math.abs(growth).toFixed(0)}%
                    </span>
                    <span>
                      vs {data.context.lastMonthName} ({money(totals.collectedLastMonth ?? 0)})
                    </span>
                  </span>
                )
              }
            />
          ) : (
            <KpiCard
              label="Expired, not renewed"
              value={totals.expiredCount.toLocaleString()}
              tone={totals.expiredCount > 0 ? "bad" : undefined}
              sub="Members to win back"
            />
          )}
          <KpiCard
            label={canSeeMoney ? "Outstanding fees" : "Members owing"}
            value={canSeeMoney ? money(totals.outstandingAmount ?? 0) : totals.owingMembers.toLocaleString()}
            tone={totals.owingMembers > 0 ? "bad" : undefined}
            sub={
              totals.owingMembers > 0 ? (
                <>
                  {canSeeMoney && `Owed by ${plural(totals.owingMembers, "member")} · `}
                  <button type="button" onClick={showOwing} className="font-medium text-foreground underline underline-offset-2">
                    See who
                  </button>
                </>
              ) : (
                "Everyone is paid up"
              )
            }
          />
          <KpiCard
            label="Expiring in 7 days"
            value={totals.expiringSoonCount.toLocaleString()}
            tone={totals.expiringSoonCount > 0 ? "due" : undefined}
            sub={
              totals.expiringSoonCount === 0
                ? "No renewals due this week"
                : canSeeMoney
                  ? `${money(totals.expiringSoonAmount ?? 0)} coming up for renewal`
                  : "Members to remind"
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          <NeedsAttention
            tab={tab}
            onTabChange={chooseTab}
            rows={{ expiring: data.attention.expiringSoon, expired: data.attention.expired, owing: data.attention.owing }}
            counts={{ expiring: totals.expiringSoonCount, expired: totals.expiredCount, owing: totals.owingMembers }}
            showAmounts={data.canSeeRowAmounts}
            gymName={gymName}
            canRemind={canRemind}
            canRenew={canRenew}
            canRecordPayment={canRecordPayment}
            onRenew={setRenewTarget}
            onRecordPayment={setPayTarget}
          />

          <div className="flex flex-col gap-4">
            {canSeeMoney && <MonthSoFar data={data} />}
            <YourGym data={data} isStaff={isStaff} canSeeEquipment={can("equipment.view")} canSeeMembers={can("members.view")} />
          </div>
        </div>

        <DashboardTrends
          months={data.charts.months}
          range={range}
          onRangeChange={setRange}
          showRevenue={canSeeMoney}
          monthName={data.context.monthName}
        />

        {data.recentPayments.length > 0 && <RecentPayments payments={data.recentPayments} />}
      </div>

      {renewTarget && (
        <RenewMemberModal
          open
          onClose={() => setRenewTarget(null)}
          memberId={renewTarget.memberId}
          memberName={renewTarget.memberName}
          defaultPrice={renewTarget.price}
          defaultBillingModel={renewTarget.billingModel}
        />
      )}
      <QuickPaymentDialog
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        member={payTarget ? { id: payTarget.memberId, name: payTarget.memberName } : null}
      />
    </PageContainer>
  )
}

/** This month's money in, out and what's left. */
function MonthSoFar({ data }: { data: OwnerOverviewResponse }) {
  const { format: money } = useGymCurrency()
  const collected = data.totals.collectedThisMonth ?? 0
  const spent = data.totals.expensesThisMonth ?? 0
  const profit = data.totals.profitThisMonth ?? 0
  const spentPct = collected > 0 ? Math.min(100, (spent / collected) * 100) : spent > 0 ? 100 : 0

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="font-heading text-base">{data.context.monthName} so far</CardTitle>
        <CardDescription>Fees collected minus expenses.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Collected</dt>
            <dd className="font-medium tabular-nums">{money(collected)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Expenses</dt>
            <dd className="font-medium tabular-nums">− {money(spent)}</dd>
          </div>
        </dl>
        <div
          className="flex h-2 overflow-hidden rounded-full bg-primary"
          role="img"
          aria-label={`Expenses are ${Math.round(spentPct)}% of fees collected`}
        >
          <div className="h-full bg-muted-foreground/40" style={{ width: `${spentPct}%` }} />
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm text-muted-foreground">Profit</span>
          <span
            className={cn(
              "font-heading text-2xl font-extrabold tabular-nums",
              profit < 0 ? "text-destructive" : "text-primary-dim"
            )}
          >
            {money(profit)}
          </span>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-11 justify-start px-0 md:h-8">
          <Link href="/expenses">
            Expenses <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

/** Counts that used to be separate cards, as links to their pages. */
function YourGym({
  data,
  isStaff,
  canSeeEquipment,
  canSeeMembers,
}: {
  data: OwnerOverviewResponse
  isStaff: boolean
  canSeeEquipment: boolean
  canSeeMembers: boolean
}) {
  const items = [
    canSeeMembers && { label: "Members", value: data.totals.totalMembers, href: "/members" },
    !isStaff && { label: "Gyms", value: data.totals.gyms, href: "/my-gym" },
    !isStaff && { label: "Branches", value: data.totals.locations, href: "/my-gym" },
    canSeeEquipment && { label: "Equipment", value: data.totals.equipment, href: "/equipment" },
  ].filter(Boolean) as Array<{ label: string; value: number; href: string }>
  if (items.length === 0) return null

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-heading text-base">Your gym</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ul>
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="flex items-center gap-2 font-semibold tabular-nums">
                  {item.value.toLocaleString()}
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function RecentPayments({ payments }: { payments: OwnerOverviewResponse["recentPayments"] }) {
  const { format: money } = useGymCurrency()
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border py-4 [.border-b]:pb-4">
        <CardTitle className="font-heading text-base">Recent payments</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-11 md:h-8">
          <Link href="/payments">
            All payments <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
              >
                {initials(p.memberName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.memberName}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <span className="rounded-full border border-border px-2 text-xs">{paymentMethodLabel(p.paymentMethod)}</span>
                  {formatDate(p.paymentDate)}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{money(p.amount)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export default OwnerDashboard
