"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Banknote, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WhatsAppReminderButton } from "@/components/common/whatsapp-actions"
import { useGymCurrency } from "@/hooks/useGymCurrency"
import { billingModelLabel } from "@/lib/format"
import { expiryStatus, initials } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import type { AttentionRow, OwingRow } from "@/pages/api/dashboard/owner-overview"

export type AttentionTab = "expiring" | "expired" | "owing"

type Props = {
  tab: AttentionTab
  onTabChange: (tab: AttentionTab) => void
  rows: { expiring: AttentionRow[]; expired: AttentionRow[]; owing: OwingRow[] }
  counts: { expiring: number; expired: number; owing: number }
  showAmounts: boolean
  gymName: string | null
  canRemind: boolean
  canRenew: boolean
  canRecordPayment: boolean
  onRenew: (row: AttentionRow) => void
  onRecordPayment: (row: OwingRow) => void
}

const TABS: Array<{ id: AttentionTab; label: string; short: string }> = [
  { id: "expiring", label: "Expiring soon", short: "Expiring" },
  { id: "expired", label: "Expired", short: "Expired" },
  { id: "owing", label: "Owing money", short: "Owing" },
]

const EMPTY: Record<AttentionTab, { title: string; text: string }> = {
  expiring: { title: "No one expires in the next 7 days", text: "Members whose fees run out soon show up here." },
  expired: { title: "No expired members to chase", text: "Everyone has renewed, or told you why they left." },
  owing: { title: "No one owes you money", text: "Members with an unpaid balance show up here." },
}

/** "To do today": who to remind, renew or collect from, with one-tap actions. */
export function NeedsAttention(props: Props) {
  const { tab, onTabChange, rows, counts } = props
  const list: Array<AttentionRow | OwingRow> = rows[tab]
  const total = counts[tab]

  return (
    <Card id="needs-attention" className="gap-0 overflow-hidden py-0">
      <CardHeader className="gap-3 border-b border-border py-4 [.border-b]:pb-4">
        <div>
          <CardTitle className="font-heading text-base">To do today</CardTitle>
          <CardDescription>Remind, renew or collect in one tap.</CardDescription>
        </div>
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as AttentionTab)}>
          <TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto sm:inline-grid">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="min-h-10 gap-1.5 px-2 sm:px-3">
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    counts[t.id] === 0
                      ? "bg-muted text-muted-foreground"
                      : t.id === "expiring"
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        : "bg-destructive/10 text-destructive"
                  )}
                >
                  {counts[t.id]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="px-0">
        {list.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="font-medium">{EMPTY[tab].title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{EMPTY[tab].text}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((row) => (
              <AttentionItem key={row.subscriptionId} {...props} row={row} />
            ))}
          </ul>
        )}
      </CardContent>

      {total > 0 && (
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3 text-sm [.border-t]:pt-3">
          <span className="text-muted-foreground">
            Showing {list.length} of {total}
          </span>
          <Button asChild variant="ghost" size="sm" className="h-11 md:h-8">
            <Link href={tab === "owing" ? "/payments" : "/membersubscriptions"}>
              {tab === "owing" ? "All payments" : "All memberships"} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function AttentionItem({
  row,
  tab,
  showAmounts,
  gymName,
  canRemind,
  canRenew,
  canRecordPayment,
  onRenew,
  onRecordPayment,
}: Props & { row: AttentionRow | OwingRow }) {
  const { format } = useGymCurrency()
  const status = expiryStatus(row.endDate)
  const balance = "balance" in row ? row.balance : null

  const chip =
    tab === "owing"
      ? { label: showAmounts && balance !== null ? `Owes ${format(balance)}` : "Owes money", tone: "expired" as const }
      : status

  const details = [row.phone, billingModelLabel(row.billingModel), showAmounts ? format(row.price) : null]
    .filter(Boolean)
    .join(" · ")

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
        >
          {initials(row.memberName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{row.memberName}</p>
          <p className="truncate text-sm text-muted-foreground">{details}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            chip.tone === "due"
              ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {chip.label}
        </span>
      </div>

      <div className="flex gap-2 sm:shrink-0 [&>*]:flex-1 sm:[&>*]:flex-none">
        {tab !== "owing" && canRemind && (
          <WhatsAppReminderButton
            memberName={row.memberName}
            phone={row.phone}
            gymName={gymName}
            price={row.price}
            endDate={row.endDate}
            isExpired={tab === "expired"}
            className="h-11 md:h-8"
          />
        )}
        {tab !== "owing" && canRenew && (
          <Button size="sm" className="h-11 md:h-8" onClick={() => onRenew(row)}>
            <RotateCcw aria-hidden /> Renew
          </Button>
        )}
        {tab === "owing" && canRecordPayment && (
          <Button size="sm" className="h-11 md:h-8" onClick={() => onRecordPayment(row as OwingRow)}>
            <Banknote aria-hidden /> Record payment
          </Button>
        )}
      </div>
    </li>
  )
}
