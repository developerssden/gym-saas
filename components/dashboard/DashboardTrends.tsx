"use client"

import { Bar, BarChart, Cell, LabelList, XAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useGymCurrency } from "@/hooks/useGymCurrency"
import { CHART_RANGES, CHART_RANGE_LABELS, compactAmount, type ChartRange } from "@/lib/dashboard"
import type { OwnerOverviewResponse } from "@/pages/api/dashboard/owner-overview"

type Months = OwnerOverviewResponse["charts"]["months"]

const revenueConfig = { revenue: { label: "Collected", color: "var(--primary)" } } satisfies ChartConfig
const membersConfig = { members: { label: "New members", color: "var(--primary)" } } satisfies ChartConfig

/** Revenue and new members by month, with one range control for both. */
export function DashboardTrends({
  months,
  range,
  onRangeChange,
  showRevenue,
  monthName,
}: {
  months: Months
  range: ChartRange
  onRangeChange: (range: ChartRange) => void
  showRevenue: boolean
  monthName: string
}) {
  const { currencyCode, format } = useGymCurrency()
  const current = months[months.length - 1]
  const joinedInRange = months.reduce((sum, m) => sum + m.members, 0)

  return (
    <section aria-labelledby="trends-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="trends-heading" className="font-heading text-lg font-semibold">
          Trends
        </h2>
        <Select value={range} onValueChange={(v) => onRangeChange(v as ChartRange)}>
          <SelectTrigger className="h-11 w-[170px] md:h-9" aria-label="Chart range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {CHART_RANGES.map((r) => (
              <SelectItem key={r} value={r}>
                {CHART_RANGE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={showRevenue ? "grid gap-4 lg:grid-cols-[2fr_1fr]" : "grid gap-4"}>
        {showRevenue && (
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="font-heading text-base">Fees collected</CardTitle>
              <CardDescription>
                {monthName} so far: {format(current?.revenue ?? 0)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={months} margin={{ top: 22, left: 0, right: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(v) => format(Number(v))} hideIndicator />}
                  />
                  <Bar dataKey="revenue" radius={4}>
                    {months.map((m, i) => (
                      <Cell
                        key={m.month}
                        fill={i === months.length - 1 ? "var(--primary)" : "var(--muted-foreground)"}
                        fillOpacity={i === months.length - 1 ? 1 : 0.25}
                      />
                    ))}
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      className="fill-muted-foreground"
                      fontSize={11}
                      formatter={(v: unknown) => (Number(v) > 0 ? compactAmount(Number(v), currencyCode) : "")}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="font-heading text-base">New members</CardTitle>
            <CardDescription>
              {current?.members ?? 0} joined in {monthName} · {joinedInRange} in {CHART_RANGE_LABELS[range].toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={membersConfig} className="aspect-auto h-[220px] w-full">
              <BarChart data={months} margin={{ top: 22, left: 0, right: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="members" radius={4}>
                  {months.map((m, i) => (
                    <Cell
                      key={m.month}
                      fill={i === months.length - 1 ? "var(--primary)" : "var(--muted-foreground)"}
                      fillOpacity={i === months.length - 1 ? 1 : 0.25}
                    />
                  ))}
                  <LabelList
                    dataKey="members"
                    position="top"
                    className="fill-muted-foreground"
                    fontSize={11}
                    formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
