"use client";

import { useState } from "react";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet, FileText } from "lucide-react";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { getErrorMessage } from "@/lib/getErrorMessage";
import type { MonthlyReport } from "@/lib/monthly-report";

type ReportResponse = MonthlyReport & { scopeLabel: string };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-2xl font-semibold">{value}</p>
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
                <span className="font-medium">{value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const ReportsPage = () => {
  const { data: session, status } = useSession({ required: true });
  const { format: money } = useGymCurrency();
  const [month, setMonth] = useState(currentMonth);
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | null>(null);

  const role = session?.user?.role;
  const gymId = session?.user?.selected_gym_id || undefined;
  const locationId = session?.user?.selected_location_id || undefined;
  const params = { month, gym_id: gymId, location_id: locationId };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["monthly-report", month, gymId, locationId],
    queryFn: async () => (await axios.get<ReportResponse>("/api/reports/monthly", { params })).data,
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
      downloadBlob(res.data as Blob, `monthly-report-${month}.${format}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  const m = data?.money;
  const mem = data?.members;

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Fees, expenses, profit and members for one month. Download it to share with a partner or family.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="report-month">Month</Label>
            <Input
              id="report-month"
              type="month"
              value={month}
              max={currentMonth()}
              onChange={e => e.target.value && setMonth(e.target.value)}
              className="h-11 w-44"
            />
          </div>
          <Button variant="outline" className="h-11" disabled={!data || !!downloading} onClick={() => download("pdf")}>
            <FileText className="size-4" /> {downloading === "pdf" ? "Preparing…" : "PDF"}
          </Button>
          <Button variant="outline" className="h-11" disabled={!data || !!downloading} onClick={() => download("xlsx")}>
            <FileSpreadsheet className="size-4" /> {downloading === "xlsx" ? "Preparing…" : "Excel"}
          </Button>
        </div>
      </div>

      {!gymId && (
        <div className="mb-4 rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">Please select a gym and location from the header to see the report.</p>
        </div>
      )}

      {isLoading && gymId && (
        <div className="flex h-64 items-center justify-center">
          <FullScreenLoader label="Building report..." />
        </div>
      )}

      {error && <DataFetchError error={error} onRetry={() => refetch()} message="Error loading the report" />}

      {data && m && mem && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {data.scopeLabel} · {data.monthLabel}
            {data.isCurrentMonth && " · month in progress, figures so far"}
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Collected" value={money(m.collected)} hint={`${m.paymentsCount} payment${m.paymentsCount === 1 ? "" : "s"}`} />
            <Stat label="Expenses" value={money(m.expenses)} />
            <Stat label="Profit" value={money(m.profit)} />
            <Stat
              label="Outstanding"
              value={money(m.outstanding)}
              hint={`${m.outstandingMembers} member${m.outstandingMembers === 1 ? "" : "s"} owing`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="New members" value={String(mem.newMembers)} />
            <Stat label="Subscriptions started" value={String(mem.newSubscriptions)} hint={`${mem.renewals} renewals`} />
            <Stat label="Subscriptions ending" value={String(mem.expiries)} />
            <Stat label="Members lost" value={String(mem.lost)} hint="Ended and not renewed" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Breakdown
              title="Collected by method"
              rows={m.collectedByMethod.map(r => [r.label, money(r.amount)])}
              empty="No payments this month"
            />
            <Breakdown
              title="Expenses by category"
              rows={m.expensesByCategory.map(r => [r.label, money(r.amount)])}
              empty="No expenses this month"
            />
            <Breakdown
              title="Why members left"
              rows={mem.lostByReason.map(r => [r.label, String(r.count)])}
              empty="No members lost"
            />
            <Breakdown
              title="Top plans"
              rows={data.topPlans.map(p => [`${p.label} · ${money(p.price)}`, `${p.count} started`])}
              empty="No subscriptions started"
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default ReportsPage;
