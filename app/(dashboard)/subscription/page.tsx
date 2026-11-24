"use client";

// The owner's plan: status, what it includes and how much of each limit is used.
import Link from "next/link";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, MessageCircle } from "lucide-react";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { cn } from "@/lib/utils";
import type { UsageRow } from "@/lib/my-plan";
import { MY_PLAN_QUERY_KEY, PlanStatusChip, renewUrl, type MyPlanResponse } from "@/components/subscription/plan-status";

const day = (iso: string) => format(new Date(iso), "d MMM yyyy");

function rowNote(row: UsageRow): string {
  if (row.state === "notIncluded") return "Not included";
  if (row.state === "full") return "Limit reached";
  if (row.state === "near") return "Almost full";
  return `${row.max - row.used} left`;
}

function UsageRowView({ row, showLabel }: { row: UsageRow; showLabel: boolean }) {
  const percent = row.max > 0 ? Math.min(100, Math.round((row.used / row.max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={cn(showLabel ? "" : "sr-only")}>{row.label}</span>
        <span className="ml-auto tabular-nums">
          {row.state === "notIncluded" ? (
            <span className="text-muted-foreground">Not included</span>
          ) : (
            <>
              <strong>{row.used}</strong> of {row.max}
            </>
          )}
        </span>
      </div>
      {row.state !== "notIncluded" && (
        <Progress
          value={percent}
          aria-label={`${row.label}: ${row.used} of ${row.max} used`}
          className={cn(
            "h-2",
            row.state === "full" && "[&_[data-slot=progress-indicator]]:bg-destructive",
            row.state === "near" && "[&_[data-slot=progress-indicator]]:bg-amber-500"
          )}
        />
      )}
      {row.state !== "notIncluded" && row.state !== "ok" && (
        <p className={cn("text-xs", row.state === "full" ? "text-destructive" : "text-amber-700 dark:text-amber-300")}>
          {rowNote(row)}
        </p>
      )}
    </div>
  );
}

const SubscriptionPage = () => {
  const { data: session, status: sessionStatus } = useSession({ required: true });
  const { format: money } = useGymCurrency();
  const isOwner = session?.user?.role === "GYM_OWNER";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: MY_PLAN_QUERY_KEY,
    queryFn: async () => (await axios.get<MyPlanResponse>("/api/subscription/myplan")).data,
    enabled: isOwner,
  });

  if (sessionStatus === "loading") return <FullScreenLoader />;
  if (!isOwner) return redirect("/unauthorized");

  const status = data?.status;
  const plan = data?.plan;
  const blocked = status?.kind === "expired" || status?.kind === "none";

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="h1">Subscription</h1>
          <p className="text-sm text-muted-foreground">Your plan, what it includes and how much of it you&apos;re using.</p>
        </div>

        {isLoading && <FullScreenLoader label="Loading your plan..." />}
        {error && <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load your plan" />}

        {data && status && (
          <>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardDescription>{plan ? (blocked ? "Your last plan" : "Your plan") : "Plan"}</CardDescription>
                  <CardTitle className="text-2xl">{plan?.name ?? "No plan yet"}</CardTitle>
                  {plan && (
                    <p className="text-sm text-muted-foreground">
                      {plan.billing_model === "YEARLY" ? "Yearly" : "Monthly"} · {money(plan.price)}
                    </p>
                  )}
                </div>
                <PlanStatusChip status={status} />
              </CardHeader>
              <CardContent className="space-y-4">
                {status.kind === "active" && (
                  <p className="text-sm">
                    Active until <strong>{day(status.endsOn)}</strong> ({status.daysLeft} days left).
                  </p>
                )}
                {status.kind === "expiring" && (
                  <p className="text-sm">
                    Ends on <strong>{day(status.endsOn)}</strong>. Renew before then to keep adding members and staff.
                  </p>
                )}
                {blocked && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
                    <p className="font-semibold text-destructive">
                      {status.kind === "expired" ? `Your plan ended on ${day(status.endedOn)}` : "You don't have a plan yet"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Until you {status.kind === "expired" ? "renew" : "start a plan"} you can&apos;t add gyms, branches,
                      members, equipment or staff. Your existing data is safe.
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild className="h-11">
                    <a href={renewUrl(plan?.name)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="size-4" />
                      {blocked ? (plan ? "Renew on WhatsApp" : "Start a plan on WhatsApp") : "Renew or upgrade on WhatsApp"}
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="h-11">
                    <Link href="/pricing">See all plans</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {plan && (
              <Card>
                <CardHeader>
                  <CardTitle>What you&apos;re using</CardTitle>
                  <CardDescription>
                    {blocked ? "Limits of your last plan. Nothing new can be added until you renew." : "Against your plan's limits."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {data.usage.map(item => (
                    <section key={item.key} aria-labelledby={`usage-${item.key}`} className="space-y-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 id={`usage-${item.key}`} className="font-medium">
                          {item.label}
                        </h2>
                        {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
                      </div>
                      {item.rows.map(row => (
                        <UsageRowView key={row.label} row={row} showLabel={item.rows.length > 1 || item.hint === "Per branch"} />
                      ))}
                    </section>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.features.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Included in {plan?.name ?? "your plan"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {data.features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-dim" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default SubscriptionPage;
