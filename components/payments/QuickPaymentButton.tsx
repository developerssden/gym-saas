"use client";

// "+ Record payment": a header button on desktop and a floating button on
// phones, on every dashboard page, for owners and staff who can take fees.
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useMemberDirectory } from "@/hooks/useOffline";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";
import { useMobileTabBar } from "@/components/layout/mobile-tab-bar";
import { cn } from "@/lib/utils";

export function QuickPaymentButton() {
  const { can, isGymUser } = usePermissions();
  const [open, setOpen] = useState(false);
  // Sit above the phone tab bar when it is showing.
  const aboveTabBar = useMobileTabBar();
  const canTakeFees = isGymUser && (can("payments.record") || can("membersubscriptions.renew"));
  // Keep the member list on this device so fees can be recorded offline.
  useMemberDirectory(canTakeFees);

  if (!canTakeFees) return null;

  return (
    <>
      <Button size="sm" className="hidden md:inline-flex" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Record payment
      </Button>
      <Button
        size="icon"
        className={cn(
          "fixed right-4 z-40 size-14 rounded-full shadow-lg md:hidden",
          aboveTabBar ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
        )}
        onClick={() => setOpen(true)}
        aria-label="Record payment"
      >
        <Plus className="size-6" />
      </Button>
      <QuickPaymentDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
