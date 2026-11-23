"use client";

import { useState } from "react";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { getErrorMessage } from "@/lib/getErrorMessage";
import {
  monthLabel,
  monthOf,
  profitOrLoss,
  recentMonths,
  shiftMonth,
  type MonthlyReport,
} from "@/lib/monthly-report";
import { cn } from "@/lib/utils";

type ReportResponse = MonthlyReport & { scopeLabel: string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "loss" }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className={cn("text-2xl font-semibold tabular-nums", tone === "loss" && "text-destructive")}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: Array<[string, string]>; empty: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y text-sm">
            {rows.map(([label, value]) => (
              <li key={label} className="flex justify-between gap-4 py-2">
                <span>{label}</span>
                <span className="font-medium tabular-nums">{value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** ‹ November 2026 › with a list of recent months: works in every browser, unlike <input type="month">. */
function MonthPicker({ month, latest, onChange }: { month: string; latest: string; onChange: (month: string) => void }) {
  const months = recentMonths(latest, 24);
  if (!months.includes(month)) months.push(month);
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Month">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0 md:size-10"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label={`Previous month, ${monthLabel(shiftMonth(month, -1))}`}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Select value={month} onValueChange={onChange}>
        <SelectTrigger className="h-11 min-w-0 flex-1 sm:w-52 sm:flex-none md:h-10" aria-label="Month">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {monthLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0 md:size-10"
        disabled={month >= latest}
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label={`Next month, ${monthLabel(shiftMonth(month, 1))}`}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const ReportsPage = () => {
  const { data: session, status } = useSession({ required: true });
  const { format: money } = useGymCurrency();
  const thisMonth = monthOf(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | null>(null);

  const role = session?.user?.role;
  const gymId = session?.user?.selected_gym_id || undefined;
  const locationId = session?.user?.selected_location_id || undefined;
  const params = { month, gym_id: gymId, location_id: locationId };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["monthly-report", month, gymId, locationId],
    queryFn: async () => (await axios.get<ReportResponse>("/api/reports/monthly", { params })).data,
    // Keep the last month on screen while the next one loads.
    placeholderData: keepPreviousData,
    enabled: status === "authenticated" && (role === "GYM_OWNER" || role === "STAFF") && !!gymId && !!month,
  });

  if (status === "loading") return <FullScreenLoader />;
  if (role !== "GYM_OWNER" && role !== "STAFF") return redirect("/unauthorized");

  const download = async (format: "pdf" | "xlsx") => {
    setDownloading(format);
    try {
      const res = await axios.get("/api/reports/monthly", {
        params: { ...params, format },
        responseType: "blob",
      });
      downloadBlob(res.data as Blob, `report-${month}.${format}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  const shown = data?.month === month ? data : undefined;
  const m = data?.money;
  const mem = data?.members;
  const pl = m ? profitOrLoss(m.profit) : null;
  const canDownload = !!shown && !downloading;

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Fees, expenses, profit and members for one month. Download it to share with a partner or family."
        actions={
          gymId ? (
            <>
              <Button variant="outline" disabled={!canDownload} loading={downloading === "pdf"} onClick={() => download("pdf")}>
                {downloading !== "pdf" && <FileText aria-hidden />} Download PDF
              </Button>
              <Button variant="outline" disabled={!canDownload} loading={downloading === "xlsx"} onClick={() => download("xlsx")}>
                {downloading !== "xlsx" && <FileSpreadsheet aria-hidden />} Download Excel
              </Button>
            </>
          ) : undefined
        }
      />

      {!gymId ? (
        <div className="mb-4 rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">Choose a gym and branch at the top of the page to see the report.</p>
        </div>
      ) : (
        <div className="mb-4">
          <MonthPicker month={month} latest={thisMonth} onChange={setMonth} />
        </div>
      )}

      {gymId && isLoading && !data && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      )}

      {error && <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load the report" />}

      {data && m && mem && pl && (
        <div className={cn("space-y-4 transition-opacity", isFetching && !shown && "opacity-60")} aria-busy={isFetching}>
          <p className="text-sm text-muted-foreground">
            {data.scopeLabel} · {data.monthLabel}
            {data.isCurrentMonth && " · month in progress, figures so far"}
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Collected" value={money(m.collected)} hint={plural(m.paymentsCount, "payment")} />
            <Stat label="Expenses" value={money(m.expenses)} />
            <Stat
              label={pl.label}
              value={money(pl.amount)}
              hint={pl.isLoss ? "Spent more than collected" : undefined}
              tone={pl.isLoss ? "loss" : undefined}
            />
            <Stat label="Outstanding" value={money(m.outstanding)} hint={`${plural(m.outstandingMembers, "member")} owing`} />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="New members" value={String(mem.newMembers)} />
            <Stat label="Memberships started" value={String(mem.newSubscriptions)} hint={plural(mem.renewals, "renewal")} />
            <Stat label="Memberships ending" value={String(mem.expiries)} />
            <Stat label="Members lost" value={String(mem.lost)} hint="Ended and not renewed" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Breakdown
              title="Collected by method"
              rows={m.collectedByMethod.map((r) => [r.label, money(r.amount)])}
              empty="No payments this month"
            />
            <Breakdown
              title="Expenses by category"
              rows={m.expensesByCategory.map((r) => [r.label, money(r.amount)])}
              empty="No expenses this month"
            />
            <Breakdown
              title="Why members left"
              rows={mem.lostByReason.map((r) => [r.label, String(r.count)])}
              empty="No members lost"
            />
            <Breakdown
              title="Top plans"
              rows={data.topPlans.map((p) => [`${p.label} · ${money(p.price)}`, `${p.count} started`])}
              empty="No memberships started"
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default ReportsPage;
