"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHURN_REASONS = [
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "STOPPED_COMING", label: "Stopped coming" },
  { value: "MOVED", label: "Moved away" },
  { value: "SWITCHED_GYM", label: "Switched to another gym" },
  { value: "MEDICAL", label: "Medical / health reasons" },
  { value: "OTHER", label: "Other" },
];

interface ChurnReasonModalProps {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
  memberName: string;
}

export default function ChurnReasonModal({
  open,
  onClose,
  subscriptionId,
  memberName,
}: ChurnReasonModalProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/membersubscriptions/recordchurnreason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subscriptionId,
          churn_reason: reason,
          churn_note: note || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to record");
      }

      toast.success("Churn reason saved");
      queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setReason("");
    setNote("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why did {memberName} leave?</DialogTitle>
          <DialogDescription>
            This helps you understand your retention. You can skip this.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {CHURN_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="churn-note">
              Additional note{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="churn-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any extra detail…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || loading}>
            {loading ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
