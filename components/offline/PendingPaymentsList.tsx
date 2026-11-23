"use client";

// Payments kept on this device until they sync. Failed ones need a person:
// try again, or remove them and record the payment again online.
import { RotateCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { removeFromOutbox, updateOutboxItem } from "@/lib/offline/outbox";
import type { OutboxItem } from "@/lib/offline/outbox-types";
import { useConfirm } from "@/components/common/confirm-dialog";
import { formatDateTime, paymentMethodLabel } from "@/lib/format";

export function PendingPaymentsList({ items, onRetry }: { items: OutboxItem[]; onRetry?: () => void }) {
  const { format } = useGymCurrency();
  const { confirm, dialog: confirmDialog } = useConfirm();
  if (items.length === 0) return null;

  return (
    <>
    {confirmDialog}
    <ul className="divide-y">
      {items.map(item => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="font-medium">
              {item.memberName} · {format(item.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.kind === "renew" ? "Renewal" : "Payment"} · {paymentMethodLabel(item.method)} · {formatDateTime(item.createdAt)}
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
                className="size-11 md:size-9"
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
                className="size-11 md:size-9"
                aria-label={`Remove ${item.memberName}'s payment`}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Remove ${item.memberName}'s payment?`,
                    description: `The ${format(item.amount)} payment was never recorded. Removing it deletes it from this device, so record it again if the member did pay.`,
                    confirmLabel: "Remove payment",
                    cancelLabel: "Keep it",
                    destructive: true,
                  });
                  if (ok) void removeFromOutbox(item.id);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
    </>
  );
}
