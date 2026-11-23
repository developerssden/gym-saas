"use client";

import { useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { expenseCategoryLabel } from "@/lib/expenses";
import { cn } from "@/lib/utils";
import { formatDate, paymentMethodLabel } from "@/lib/format";

type CashBookResponse = {
  day: string;
  collected: number;
  spent: number;
  net: number;
  payments: Array<{
    id: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    member_name: string;
  }>;
  expenses: Array<{ id: string; amount: number; category: string; note: string | null }>;
};

/** One day's money in and out: member payments vs expenses. */
export function CashBook({ gymId, locationId }: { gymId?: string | null; locationId?: string | null }) {
  const { format: formatMoney } = useGymCurrency();
  const today = format(new Date(), "yyyy-MM-dd");
  const [day, setDay] = useState(today);

  const { data, isLoading, error } = useQuery<CashBookResponse>({
    queryKey: ["cashbook", day, gymId, locationId],
    queryFn: async () =>
      (
        await axios.post("/api/expenses/cashbook", {
          day,
          gym_id: gymId || undefined,
          location_id: locationId || undefined,
        })
      ).data,
    enabled: !!gymId && !!day,
  });

  const isToday = day === today;

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Cash book</CardTitle>
          <CardDescription>
            {isToday ? "Today's" : formatDate(new Date(`${day}T12:00:00`)) + "'s"} money in and out
          </CardDescription>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="cashbook-day" className="text-xs text-muted-foreground">
            Day
          </Label>
          <Input
            id="cashbook-day"
            type="date"
            max={today}
            value={day}
            onChange={(e) => setDay(e.target.value || today)}
            className="h-11 w-auto md:h-9"
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? (
          <p className="text-sm text-destructive">Couldn&apos;t load the cash book.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Collected", value: data?.collected, tone: "" },
                { label: "Spent", value: data?.spent, tone: "" },
                {
                  label: "Net",
                  value: data?.net,
                  tone: (data?.net ?? 0) < 0 ? "text-destructive" : "text-primary-dim",
                },
              ].map((item) => (
                <div key={item.label} className="min-w-0 rounded-md border px-2.5 py-2.5 sm:px-3">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className={cn("break-words text-base font-semibold sm:text-xl", item.tone)}>
                    {isLoading || item.value === undefined ? "…" : formatMoney(item.value)}
                  </div>
                </div>
              ))}
            </div>

            {data && (data.payments.length > 0 || data.expenses.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">In · {data.payments.length} payment{data.payments.length === 1 ? "" : "s"}</h3>
                  <ul className="divide-y rounded-md border text-sm">
                    {data.payments.length === 0 && <li className="px-3 py-2 text-muted-foreground">No payments</li>}
                    {data.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span>
                          {p.member_name}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {paymentMethodLabel(p.payment_method)}
                          </span>
                        </span>
                        <span className="font-medium">{formatMoney(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Out · {data.expenses.length} expense{data.expenses.length === 1 ? "" : "s"}</h3>
                  <ul className="divide-y rounded-md border text-sm">
                    {data.expenses.length === 0 && <li className="px-3 py-2 text-muted-foreground">No expenses</li>}
                    {data.expenses.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span>
                          {expenseCategoryLabel(e.category)}
                          {e.note && <span className="ml-1.5 text-xs text-muted-foreground">{e.note}</span>}
                        </span>
                        <span className="font-medium">{formatMoney(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {data && data.payments.length === 0 && data.expenses.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing recorded {isToday ? "yet today" : "on this day"}.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
