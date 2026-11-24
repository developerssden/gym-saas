"use client";

import Link from "next/link";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

import DataFetchError from "@/components/common/DataFetchError";
import {
  MY_PLAN_QUERY_KEY,
  PlanStatusChip,
  renewUrl,
  type MyPlanResponse,
} from "@/components/subscription/plan-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { formatDate } from "@/lib/format";
import type { UsageRow } from "@/lib/my-plan";

/** Owner only: the plan in one glance, with the full usage on the Subscription page. */
export function PlanSection() {
  const { format: money } = useGymCurrency();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: MY_PLAN_QUERY_KEY,
    queryFn: async () => (await axios.get<MyPlanResponse>("/api/subscription/myplan")).data,
  });

  const status = data?.status;
  const plan = data?.plan;
  const blocked = status?.kind === "expired" || status?.kind === "none";
  // Limits that are full or nearly full, so they show here without opening the usage page.
  const tight: UsageRow[] = (data?.usage ?? []).flatMap(item =>
    item.rows.filter(r => r.state === "full" || r.state === "near").map(r => ({ ...r, label: item.rows.length > 1 ? `${item.label}: ${r.label}` : item.label }))
  );

  return (
    <Card id="plan" className="scroll-mt-20">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Plan &amp; billing</CardTitle>
          <CardDescription>Your Kettlio plan and what it allows.</CardDescription>
        </div>
        {status && <PlanStatusChip status={status} />}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-16 w-full" />}
        {error && <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load your plan" />}

        {data && status && (
          <>
            <div>
              <p className="text-lg font-semibold">{plan?.name ?? "No plan yet"}</p>
              {plan && (
                <p className="text-sm text-muted-foreground">
                  {plan.billing_model === "YEARLY" ? "Yearly" : "Monthly"} · {money(plan.price)}
                </p>
              )}
              <p className="mt-2 text-sm">
                {status.kind === "active" && (
                  <>
                    Active until <strong>{formatDate(status.endsOn)}</strong> ({status.daysLeft} days left).
                  </>
                )}
                {status.kind === "expiring" && (
                  <>
                    Ends on <strong>{formatDate(status.endsOn)}</strong>. Renew before then to keep adding members and staff.
                  </>
                )}
                {status.kind === "expired" && (
                  <span className="text-destructive">
                    Ended on <strong>{formatDate(status.endedOn)}</strong>. You can&apos;t add anything new until you renew. Your data is safe.
                  </span>
                )}
                {status.kind === "none" && "Start a plan to add gyms, members and staff."}
              </p>
            </div>

            {tight.length > 0 && (
              <ul className="space-y-1 text-sm">
                {tight.map(r => (
                  <li key={r.label} className={r.state === "full" ? "text-destructive" : "text-amber-800 dark:text-amber-300"}>
                    {r.label}: {r.used} of {r.max} used{r.state === "full" ? " (limit reached)" : ""}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="h-11 md:h-10">
                <a href={renewUrl(plan?.name)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden />
                  {blocked ? (plan ? "Renew on WhatsApp" : "Start a plan on WhatsApp") : "Renew or upgrade on WhatsApp"}
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 md:h-10">
                <Link href="/subscription">See plan usage</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
