"use client";

import { useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/getErrorMessage";

type FreezeDialogProps = {
  open: boolean;
  onClose: () => void;
  mode: "freeze" | "unfreeze";
  subscriptionId: string;
  memberName: string;
  startDate: string | Date;
  endDate: string | Date;
  frozenSince?: string | Date | null;
};

/** Local calendar day as YYYY-MM-DD (what <input type="date"> uses). */
function toDayString(value: string | Date): string {
  return format(new Date(value), "yyyy-MM-dd");
}

/** Whole days between two YYYY-MM-DD strings. */
function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function prettyDay(value: string | Date): string {
  return format(new Date(value), "d MMM yyyy");
}

export default function FreezeDialog(props: FreezeDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Remount on open so the dates start from today again. */}
        {props.open && <FreezeForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function FreezeForm({
  onClose,
  mode,
  subscriptionId,
  memberName,
  startDate,
  endDate,
  frozenSince,
}: FreezeDialogProps) {
  const queryClient = useQueryClient();
  const today = toDayString(new Date());
  const [day, setDay] = useState(today);
  const [reason, setReason] = useState("");

  const isFreeze = mode === "freeze";
  const minDay = isFreeze ? toDayString(startDate) : toDayString(frozenSince ?? today);

  const dayError =
    !day
      ? "Pick a date"
      : day > today
        ? "Can't be in the future"
        : day < minDay
          ? isFreeze
            ? "Can't be before the subscription started"
            : "Can't be before the freeze started"
          : null;

  // Unfreeze preview: the end date moves out by the days missed.
  const daysAdded = !isFreeze && !dayError ? Math.max(daysBetween(minDay, day), 0) : 0;
  const newEnd = new Date(new Date(endDate).getTime() + daysAdded * 86_400_000);

  const mutation = useMutation({
    mutationFn: () =>
      isFreeze
        ? axios.post("/api/membersubscriptions/freeze", {
            id: subscriptionId,
            start_date: day,
            reason: reason.trim() || undefined,
          })
        : axios.post("/api/membersubscriptions/unfreeze", { id: subscriptionId, back_on: day }),
    onSuccess: (res) => {
      if (isFreeze) {
        toast.success(`${memberName}'s membership is frozen.`);
      } else {
        const added = res.data?.days_added ?? daysAdded;
        toast.success(
          added > 0
            ? `${memberName} is back. End date moved ${added} day${added === 1 ? "" : "s"} later.`
            : `${memberName} is back. End date unchanged.`
        );
      }
      queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["membersubscription-history"] });
      queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-profile"] });
      onClose();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!dayError) mutation.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {isFreeze ? "Freeze" : "Unfreeze"} — {memberName}
        </DialogTitle>
        <DialogDescription>
          {isFreeze
            ? "Pause the membership while they're away. No reminders or expiry while frozen. When they're back, unfreeze and their end date moves out by the days they missed."
            : `Frozen since ${prettyDay(frozenSince ?? today)}. Their end date moves out by the days they were away.`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="freeze-day">{isFreeze ? "Frozen from" : "Back on"}</Label>
          <Input
            id="freeze-day"
            type="date"
            value={day}
            min={minDay}
            max={today}
            onChange={(e) => setDay(e.target.value)}
            aria-invalid={!!dayError || undefined}
            aria-describedby={dayError ? "freeze-day-error" : undefined}
          />
          {dayError && (
            <p id="freeze-day-error" className="text-sm text-destructive">
              {dayError}
            </p>
          )}
        </div>

        {isFreeze ? (
          <div className="grid gap-1.5">
            <Label htmlFor="freeze-reason">Reason (optional)</Label>
            <Input
              id="freeze-reason"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Travelling, injury, exams, Ramadan"
            />
          </div>
        ) : (
          !dayError && (
            <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
              <div className="text-xs text-muted-foreground">End date</div>
              <div className="font-semibold">
                {daysAdded > 0 ? (
                  <>
                    {prettyDay(endDate)} → {prettyDay(newEnd)}{" "}
                    <span className="font-normal text-muted-foreground">
                      (+{daysAdded} day{daysAdded === 1 ? "" : "s"})
                    </span>
                  </>
                ) : (
                  <>{prettyDay(endDate)} (unchanged)</>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending || !!dayError}>
          {mutation.isPending ? "Saving..." : isFreeze ? "Freeze membership" : "Unfreeze"}
        </Button>
      </DialogFooter>
    </form>
  );
}
