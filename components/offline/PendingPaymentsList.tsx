"use client";

// Payments kept on this device until they sync. Failed ones need a person:
// try again, or remove them and record the payment again online.
import { RotateCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { removeFromOutbox, updateOutboxItem } from "@/lib/offline/outbox";
import type { OutboxItem } from "@/lib/offline/outbox-types";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function PendingPaymentsList({ items, onRetry }: { items: OutboxItem[]; onRetry?: () => void }) {
  const { format } = useGymCurrency();
  if (items.length === 0) return null;

  return (
    <ul className="divide-y">
      {items.map(item => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="font-medium">
              {item.memberName} · {format(item.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.kind === "renew" ? "Renewal" : "Payment"} · {item.method === "CASH" ? "Cash" : "Bank transfer"} · {when(item.createdAt)}
            </p>
            {item.status === "failed" && item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
          </div>
          {item.status === "pending" ? (
            <Badge variant="secondary">Waiting to sync</Badge>
          ) : (
            <div className="flex items-center gap-1">
              <Badge variant="destructive">Not synced</Badge>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={`Try ${item.memberName}'s payment again`}
                onClick={async () => {
                  await updateOutboxItem(item.id, { status: "pending", error: undefined, attempts: 0 });
                  onRetry?.();
                }}
              >
                <RotateCw className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={`Remove ${item.memberName}'s payment`}
                onClick={() => {
                  if (confirm(`Remove ${item.memberName}'s ${format(item.amount)} payment from this device? It was not recorded.`)) {
                    void removeFromOutbox(item.id);
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
