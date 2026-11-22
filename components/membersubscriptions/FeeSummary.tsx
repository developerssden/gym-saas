"use client";

import { useGymCurrency } from "@/hooks/useGymCurrency";
import { cn } from "@/lib/utils";

type FeeSummaryProps = {
  amountDue: number;
  /** Paid now (create/renew) or paid so far (edit). */
  amountPaid: number;
  paidLabel?: string;
  className?: string;
};

/** "Total due · Paid now · Balance" line under fee inputs. */
export function FeeSummary({ amountDue, amountPaid, paidLabel = "Paid now", className }: FeeSummaryProps) {
  const { format } = useGymCurrency();
  const balance = Math.max(amountDue - amountPaid, 0);

  return (
    <dl
      className={cn(
        "grid grid-cols-3 gap-2 rounded-md border bg-muted/40 px-3 py-2.5 text-sm",
        className
      )}
    >
      <div>
        <dt className="text-xs text-muted-foreground">Total due</dt>
        <dd className="font-semibold">{format(amountDue)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">{paidLabel}</dt>
        <dd className="font-semibold">{format(Math.min(amountPaid, amountDue))}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Balance</dt>
        <dd className={cn("font-semibold", balance > 0 ? "text-destructive" : "text-primary-dim")}>
          {balance > 0 ? format(balance) : "Paid in full"}
        </dd>
      </div>
    </dl>
  );
}
