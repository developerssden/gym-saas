"use client";

// "+ Record payment": a header button on desktop and a floating button on
// phones, on every dashboard page, for owners and staff who can take fees.
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useMemberDirectory } from "@/hooks/useOffline";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";

export function QuickPaymentButton() {
  const { can, isGymUser } = usePermissions();
  const [open, setOpen] = useState(false);
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
        className="fixed bottom-5 right-5 z-40 size-14 rounded-full shadow-lg md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Record payment"
      >
        <Plus className="size-6" />
      </Button>
      <QuickPaymentDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
