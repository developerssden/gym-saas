"use client"

import * as React from "react"
import axios from "axios"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  Building2,
  DollarSign,
  MapPin,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react"
import { signOut } from "next-auth/react"

import { PageContainer } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import DataFetchError from "@/components/common/DataFetchError"
import DateRangePicker from "@/components/date-range-picker"
import { addDays } from "date-fns"
import type { DateRange } from "react-day-picker"

type DashboardOverview = {
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
    activeSubscriptions: SubscriptionRow[]
    expiredSubscriptions: SubscriptionRow[]
  }
}

type SubscriptionRow = {
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
}

function formatCurrency(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(safe)
}

function formatPct(pct: number) {
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString()
}

const revenueMonthConfig = {
  revenue: { label: "Revenue", color: "var(--color-chart-2)" },
} satisfies ChartConfig

const newClientsConfig = {
  clients: { label: "New clients", color: "var(--color-chart-3)" },
} satisfies ChartConfig

function AdminDashboardSkeleton() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-4 w-[420px] max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-xl border bg-card" />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[360px] rounded-xl border bg-card" />
          <Skeleton className="h-[360px] rounded-xl border bg-card" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[420px] rounded-xl border bg-card" />
          <Skeleton className="h-[420px] rounded-xl border bg-card" />
        </div>
      </div>
    </PageContainer>
  )
}

const subscriptionColumns: ColumnDef<SubscriptionRow>[] = [
  {
    id: "owner",
    accessorFn: (row) => `${row.ownerName} ${row.ownerEmail}`.trim(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Owner" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col min-w-[220px]">
        <span className="font-medium">{row.original.ownerName}</span>
        <span className="text-xs text-muted-foreground">
          {row.original.ownerEmail}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "planName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Plan" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.planName}</span>
    ),
  },
  {
    accessorKey: "billingModel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Billing" />
    ),
  },
  {
    id: "term",
    accessorFn: (row) => `${row.startDate} ${row.endDate}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Term" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{formatDate(row.original.startDate)}</span>
        <span className="text-xs text-muted-foreground">
          → {formatDate(row.original.endDate)}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    accessorFn: (row) =>
      row.isExpired ? "Expired" : row.isActive ? "Active" : "Inactive",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      if (row.original.isExpired) {
        return <Badge variant="destructive">Expired</Badge>
      }
      if (row.original.isActive) {
        return <Badge variant="secondary">Active</Badge>
      }
      return <Badge variant="outline">Inactive</Badge>
    },
  },
  {
    id: "lastPayment",
    accessorFn: (row) => row.lastPaymentAmount ?? 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last payment" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-mono tabular-nums">
          {row.original.lastPaymentAmount === null
            ? "-"
            : formatCurrency(row.original.lastPaymentAmount)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(row.original.lastPaymentDate)}
        </span>
      </div>
    ),
  },
]

const AdminDashboard = () => {
  const [chartRange, setChartRange] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  })

  const { data, isLoading, error, refetch, isFetching } = useQuery<
    DashboardOverview,
    Error
  >({
    queryKey: [
      "adminDashboardOverview",
      chartRange?.from?.toISOString() ?? null,
      chartRange?.to?.toISOString() ?? null,
    ],
    queryFn: async () => {
      const res = await axios.post<DashboardOverview>("/api/dashboard/overview", {
        from: chartRange?.from?.toISOString(),
        to: chartRange?.to?.toISOString(),
      })
      return res.data
    },
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  })

  const revenueTicks = React.useMemo(() => {
    const step = 5000
    const series = data?.charts?.revenueByMonth ?? []
    const max = Math.max(0, ...series.map((d) => d.revenue ?? 0))
    const top = Math.max(step, Math.ceil(max / step) * step)
    const ticks: number[] = []
    for (let v = 0; v <= top; v += step) ticks.push(v)
    return ticks
  }, [data])

  const [activePagination, setActivePagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [expiredPagination, setExpiredPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [activeSearch, setActiveSearch] = React.useState("")
  const [expiredSearch, setExpiredSearch] = React.useState("")

  if (isLoading && !data) return <AdminDashboardSkeleton />

  if (error && !data) {
    return (
      <PageContainer>
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading dashboard"
        />
      </PageContainer>
    )
  }

  if (!data) return null

  const growthLabel =
    data.totals.revenueGrowthPct === null
      ? "—"
      : formatPct(data.totals.revenueGrowthPct)

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="h1">Admin Dashboard</h1>
              {isFetching && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="size-3 animate-spin" />
                  Updating
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Platform overview: clients, subscriptions, revenue, gyms & locations.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        {error && (
          <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>Couldn’t refresh dashboard data. Showing last results.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users className="size-4 text-muted-foreground" />
                Total clients
              </CardTitle>
              <CardDescription>Gym owners on the platform</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {data.totals.totalClients.toLocaleString()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="size-4 text-muted-foreground" />
                Revenue (MTD)
              </CardTitle>
              <CardDescription>This month so far</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(data.totals.revenueThisMonth)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="size-4 text-muted-foreground" />
                Monthly growth
              </CardTitle>
              <CardDescription>Revenue vs last month</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {growthLabel}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="size-4 text-muted-foreground" />
                Total gyms
              </CardTitle>
              <CardDescription>All gyms</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {data.totals.totalGyms.toLocaleString()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="size-4 text-muted-foreground" />
                Total locations
              </CardTitle>
              <CardDescription>All gym locations</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {data.totals.totalLocations.toLocaleString()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                Subscriptions
              </CardTitle>
              <CardDescription>Active vs expired</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active</span>
                <span className="font-semibold">
                  {data.totals.activeOwnerSubscriptions.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expired</span>
                <span className="font-semibold">
                  {data.totals.expiredOwnerSubscriptions.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Monthly revenue</CardTitle>
                  <CardDescription>Selected date range</CardDescription>
                </div>
                <DateRangePicker
                  className="sm:justify-self-end"
                  buttonClassName="w-full sm:w-[260px]"
                  value={chartRange}
                  onRangeChange={setChartRange}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={revenueMonthConfig}
                className="aspect-auto h-[260px] w-full"
              >
                <BarChart data={data.charts.revenueByMonth}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={86}
                    allowDecimals={false}
                    ticks={revenueTicks}
                    domain={[0, revenueTicks[revenueTicks.length - 1] ?? 5000]}
                    tickFormatter={(v) => formatCurrency(Number(v))}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>New clients</CardTitle>
              <CardDescription>New gym-owner signups per month (same range)</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={newClientsConfig}
                className="aspect-auto h-[260px] w-full"
              >
                <BarChart data={data.charts.newClientsByMonth}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} width={56} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="clients" fill="var(--color-clients)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Active subscription users</CardTitle>
              <CardDescription>Currently active gym-owner subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={subscriptionColumns}
                data={data.tables.activeSubscriptions}
                searchableColumns={["owner", "planName", "billingModel"]}
                pagination={activePagination}
                onPaginationChange={setActivePagination}
                searchValue={activeSearch}
                onSearchChange={setActiveSearch}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expired users</CardTitle>
              <CardDescription>Expired gym-owner subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={subscriptionColumns}
                data={data.tables.expiredSubscriptions}
                searchableColumns={["owner", "planName", "billingModel"]}
                pagination={expiredPagination}
                onPaginationChange={setExpiredPagination}
                searchValue={expiredSearch}
                onSearchChange={setExpiredSearch}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}

export default AdminDashboard