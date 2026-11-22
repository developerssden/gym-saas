"use client";

// Header indicator: "Offline" while there's no connection, and how many
// payments are waiting on this device. Also syncs them when the connection
// returns, on load, and every 30 seconds while any are waiting.
import { useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudUpload, TriangleAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PendingPaymentsList } from "@/components/offline/PendingPaymentsList";
import { PAYMENT_QUERY_KEYS } from "@/lib/payment-queries";
import { useOnline, useOutbox } from "@/hooks/useOffline";
import { syncOutbox } from "@/lib/offline/sync";

const SYNC_EVERY_MS = 30 * 1000;

export function OfflineStatus() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const online = useOnline();
  const outbox = useOutbox();
  const pending = outbox.filter(i => i.status === "pending").length;
  const failed = outbox.length - pending;

  const sync = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    const { synced, failed: newlyFailed } = await syncOutbox(userId);
    if (synced > 0) {
      toast.success(`${synced} offline payment${synced === 1 ? "" : "s"} synced`);
      for (const key of PAYMENT_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
    }
    if (newlyFailed > 0) {
      toast.error(`${newlyFailed} offline payment${newlyFailed === 1 ? "" : "s"} couldn't be recorded. Tap the sync status to review.`);
    }
  }, [userId, queryClient]);

  // Back online, or opened with payments waiting.
  useEffect(() => {
    if (online && pending > 0) void sync();
  }, [online, pending, sync]);

  useEffect(() => {
    if (!online || pending === 0) return;
    const timer = window.setInterval(() => void sync(), SYNC_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [online, pending, sync]);

  if (online && outbox.length === 0) return null;

  const label = !online
    ? pending > 0
      ? `Offline · ${pending} waiting`
      : "Offline"
    : failed > 0
      ? `${failed} not synced`
      : `Syncing ${pending}…`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={
            failed > 0
              ? "border-destructive/40 text-destructive"
              : !online
                ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                : ""
          }
        >
          {failed > 0 ? <TriangleAlert className="size-4" /> : !online ? <WifiOff className="size-4" /> : <CloudUpload className="size-4" />}
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{!online ? (pending || "") : failed || pending}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="font-medium">{online ? "Sync" : "You're offline"}</p>
        <p className="mb-2 text-sm text-muted-foreground">
          {outbox.length === 0
            ? "You can still record payments. They're kept on this device and sent when you're back online."
            : online
              ? "Payments recorded on this device while offline."
              : "These payments are kept on this device and will be sent when you're back online."}
        </p>
        <PendingPaymentsList items={outbox} onRetry={() => void sync()} />
      </PopoverContent>
    </Popover>
  );
}
